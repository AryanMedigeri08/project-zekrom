"""
FastAPI Backend — Resilient Public Transport Tracking System.

Phase 1 responsibilities:
  1. Run the GPS emitter as a background simulation task
  2. Broadcast bus position updates to connected frontend WebSocket clients
  3. Respect signal-strength tiers — throttle emission rate accordingly
  4. Buffer pings during dead-zone (< 10 %) and flush when signal recovers
  5. Send heartbeats every 1 s so the frontend always knows the signal state
  6. Expose REST endpoints for bus state and signal strength control

Phase 2 additions:
  7. ML-based ETA prediction endpoint (/api/predict-eta)
  8. What-If simulation config endpoint (/api/sim-config)
  9. Trip status endpoint (/api/trip-status)
  10. System decision log endpoint (/api/system-log)
"""

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set

import joblib
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import (
    ROUTE_WAYPOINTS,
    SIMULATION_TICK_S,
    HEARTBEAT_INTERVAL_S,
    DEFAULT_SIGNAL_STRENGTH,
    TOTAL_ROUTE_KM,
    get_ping_interval,
    sim_config,
)
from gps_emitter import GPSEmitter
from buffer import PingBuffer
from logger import system_logger


# ---------------------------------------------------------------------------
# Application State (module-level singletons)
# ---------------------------------------------------------------------------

emitter = GPSEmitter(ROUTE_WAYPOINTS)
ping_buffer = PingBuffer()
connected_clients: Set[WebSocket] = set()

# Mutable state wrapped in a dict so async tasks can mutate it freely
state: Dict[str, Any] = {
    "signal_strength": DEFAULT_SIGNAL_STRENGTH,
    "last_ping": None,           # most recent ping dict
    "last_emit_time": 0.0,       # monotonic clock of last emission
    "last_heartbeat_time": 0.0,  # monotonic clock of last heartbeat
    "was_dead": False,           # tracks dead → alive transition for flushing
    "trip_start_time": None,     # set on first tick
    "last_real_ping_time": 0.0,  # monotonic time of last real (non-buffered) ping
}

# ML model — loaded at startup
eta_model = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), "eta_model.pkl")


# ---------------------------------------------------------------------------
# Lifespan — launch background tasks on startup, load ML model
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the GPS simulation loop when the server boots and load the ML model."""
    global eta_model

    # Load the ETA prediction model if available
    if os.path.exists(MODEL_PATH):
        eta_model = joblib.load(MODEL_PATH)
        print(f"✓ ETA model loaded from {MODEL_PATH}")
        system_logger.info("ETA prediction model loaded successfully.")
    else:
        print(f"⚠ No ETA model found at {MODEL_PATH} — /api/predict-eta will be unavailable.")
        system_logger.warn("ETA model not found. Run train_eta_model.py first.")

    state["trip_start_time"] = time.monotonic()
    system_logger.info("System started. GPS simulation loop active.")

    task = asyncio.create_task(simulation_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Resilient Transport Tracker — Backend",
    version="2.0.0",
    lifespan=lifespan,
)

# Allow the React dev server (localhost:5173) and any origin for demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# WebSocket — Frontend clients connect here
# ---------------------------------------------------------------------------

@app.websocket("/ws/client")
async def ws_client_endpoint(websocket: WebSocket):
    """
    Each frontend tab opens one WebSocket here.
    On connect we immediately send the route definition and current state.
    Then we keep the socket alive; push messages are sent by the simulation loop.
    """
    await websocket.accept()
    connected_clients.add(websocket)

    # Send route info and current state on connect
    route_data = [
        {
            "lat": wp.lat,
            "lng": wp.lng,
            "name": wp.name,
            "is_stop": wp.is_stop,
        }
        for wp in ROUTE_WAYPOINTS
    ]
    init_payload = {
        "type": "init",
        "route": route_data,
        "bus": state["last_ping"],
        "signal_strength": state["signal_strength"],
        "buffer_size": ping_buffer.size,
    }
    try:
        await websocket.send_json(init_payload)
    except Exception:
        connected_clients.discard(websocket)
        return

    # Hold the connection open; we don't expect client messages, but
    # we need to keep reading to detect disconnects.
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
    except Exception:
        connected_clients.discard(websocket)


# ---------------------------------------------------------------------------
# Broadcasting helper
# ---------------------------------------------------------------------------

async def broadcast(message: Dict[str, Any]) -> None:
    """Push a JSON message to every connected frontend client."""
    dead: Set[WebSocket] = set()
    for ws in connected_clients:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


# ---------------------------------------------------------------------------
# Core Simulation Loop
# ---------------------------------------------------------------------------

async def simulation_loop() -> None:
    """
    Runs continuously in the background. Each tick:
      1. Advance the bus physics
      2. Generate a ping
      3. Either emit, buffer, or flush depending on signal strength
      4. Send heartbeats at a fixed cadence for the network panel
    """
    while True:
        await asyncio.sleep(SIMULATION_TICK_S)

        # 1. Advance physics
        emitter.update(SIMULATION_TICK_S)

        # 2. Build ping — use sim_config.signal_strength (Phase 2 aware)
        sig = sim_config.signal_strength
        state["signal_strength"] = sig
        ping = emitter.create_ping(sig)
        state["last_ping"] = ping

        now = time.monotonic()
        interval = sim_config.derive_ping_interval()

        # 3a. Dead zone — buffer
        if interval is None:
            # Respect buffer size limit from sim_config
            if ping_buffer.size < sim_config.buffer_size_limit:
                ping_buffer.store(ping)
            system_logger.buffer_storing(ping_buffer.size)
            if not state["was_dead"]:
                system_logger.ghost_activated()
            state["was_dead"] = True
        else:
            # 3b. Signal just recovered — flush the buffer first
            if state["was_dead"] and ping_buffer.size > 0:
                flushed = ping_buffer.flush()
                await broadcast({
                    "type": "buffer_flush",
                    "pings": flushed,
                    "buffer_size": 0,
                })
                system_logger.buffer_flushed(len(flushed))
                system_logger.ghost_deactivated()
            state["was_dead"] = False

            # 3c. Normal emission at the tier's cadence
            if now - state["last_emit_time"] >= interval:
                state["last_emit_time"] = now
                state["last_real_ping_time"] = now
                await broadcast({
                    "type": "position_update",
                    "data": ping,
                    "buffer_size": ping_buffer.size,
                })

        # 4. Heartbeat — always sent so the frontend can drive
        #    the network-health waveform even during dead zones.
        if now - state["last_heartbeat_time"] >= HEARTBEAT_INTERVAL_S:
            state["last_heartbeat_time"] = now
            await broadcast({
                "type": "heartbeat",
                "signal_strength": sig,
                "buffer_size": ping_buffer.size,
                "timestamp": ping["timestamp"],
            })


# ═══════════════════════════════════════════════════════════════════════════
# REST Endpoints — Phase 1 (preserved)
# ═══════════════════════════════════════════════════════════════════════════

class SignalRequest(BaseModel):
    strength: int = Field(..., ge=0, le=100, description="Signal strength 0–100")


@app.get("/api/bus-state")
async def get_bus_state():
    """Return the latest known bus state, signal info, and buffer size."""
    return {
        "bus": state["last_ping"],
        "signal_strength": state["signal_strength"],
        "buffer_size": ping_buffer.size,
    }


@app.post("/api/signal")
async def set_signal(payload: SignalRequest):
    """
    Set the simulated signal strength (0–100).
    Immediately broadcasts the change to all connected clients.
    """
    old_strength = sim_config.signal_strength
    new_strength = max(0, min(100, payload.strength))
    sim_config.signal_strength = new_strength
    state["signal_strength"] = new_strength

    # Log the change
    if old_strength != new_strength:
        system_logger.signal_changed(old_strength, new_strength)

    await broadcast({
        "type": "signal_update",
        "signal_strength": new_strength,
        "buffer_size": ping_buffer.size,
    })

    return {"signal_strength": new_strength}


@app.get("/api/route")
async def get_route():
    """Return the full route definition (useful for non-WebSocket consumers)."""
    return [
        {
            "lat": wp.lat,
            "lng": wp.lng,
            "name": wp.name,
            "is_stop": wp.is_stop,
        }
        for wp in ROUTE_WAYPOINTS
    ]


# ═══════════════════════════════════════════════════════════════════════════
# REST Endpoints — Phase 2 (new)
# ═══════════════════════════════════════════════════════════════════════════

# ---------------------------------------------------------------------------
# POST /api/predict-eta  — ML-based ETA prediction
# ---------------------------------------------------------------------------

class ETARequest(BaseModel):
    departure_time: int = Field(..., ge=0, le=23, description="Hour of day")
    day_of_week: int = Field(..., ge=0, le=6, description="0=Mon..6=Sun")
    traffic_level: int = Field(..., ge=0, le=2, description="0=low 1=med 2=high")
    avg_signal_strength: int = Field(..., ge=0, le=100)
    weather: int = Field(..., ge=0, le=2, description="0=clear 1=cloudy 2=rain")
    num_passengers_approx: int = Field(35, ge=10, le=60)
    elapsed_minutes: float = Field(0.0, ge=0, description="Minutes already traveled")
    current_stop_index: int = Field(0, ge=0, description="Index of current stop")


class ETAResponse(BaseModel):
    predicted_remaining_minutes: float
    predicted_arrival_time: str
    confidence_low: float
    confidence_high: float
    confidence_width: str   # "narrow" | "medium" | "wide"
    signal_penalty_applied: bool
    model_version: str


@app.post("/api/predict-eta", response_model=ETAResponse)
async def predict_eta(req: ETARequest):
    """
    Predict remaining travel time using the trained ML model.

    Confidence intervals widen as signal quality degrades:
      • 70–100 %: ±15 % (narrow)
      • 40–70 %:  ±25 % (medium)
      •  0–40 %:  ±40 % (wide)
    """
    if eta_model is None:
        # Fallback: heuristic-based prediction
        base = 28.0
        remaining = max(0, base - req.elapsed_minutes)
        predicted = remaining
    else:
        features = np.array([[
            req.departure_time,
            req.day_of_week,
            req.traffic_level,
            req.avg_signal_strength,
            req.weather,
            req.num_passengers_approx,
        ]])
        total_predicted = float(eta_model.predict(features)[0])
        predicted = max(0, total_predicted - req.elapsed_minutes)

    # Confidence interval based on signal strength
    sig = req.avg_signal_strength
    if sig >= 70:
        margin_pct = 0.15
        width_label = "narrow"
    elif sig >= 40:
        margin_pct = 0.25
        width_label = "medium"
    else:
        margin_pct = 0.40
        width_label = "wide"

    margin = predicted * margin_pct
    conf_low = max(0, round(predicted - margin, 1))
    conf_high = round(predicted + margin, 1)

    # Compute predicted arrival time
    now = datetime.now()
    arrival = now + timedelta(minutes=predicted)
    arrival_str = arrival.strftime("%H:%M")

    signal_penalty = sig < 40

    return ETAResponse(
        predicted_remaining_minutes=round(predicted, 1),
        predicted_arrival_time=arrival_str,
        confidence_low=conf_low,
        confidence_high=conf_high,
        confidence_width=width_label,
        signal_penalty_applied=signal_penalty,
        model_version="gradient_boosting_v1" if eta_model else "heuristic_fallback",
    )


# ---------------------------------------------------------------------------
# POST /api/sim-config  — What-If Simulation Dashboard control
# ---------------------------------------------------------------------------

class SimConfigRequest(BaseModel):
    signal_strength: Optional[int] = Field(None, ge=0, le=100)
    packet_loss: Optional[int] = Field(None, ge=0, le=50)
    latency_ms: Optional[int] = Field(None, ge=0, le=2000)
    bus_speed_override: Optional[float] = Field(None, ge=0, le=80)
    traffic_level: Optional[int] = Field(None, ge=0, le=2)
    weather: Optional[int] = Field(None, ge=0, le=2)
    buffer_size_limit: Optional[int] = Field(None, ge=10, le=200)
    interpolation_mode: Optional[str] = None


@app.post("/api/sim-config")
async def update_sim_config(payload: SimConfigRequest):
    """
    Apply simulation configuration changes from the What-If dashboard.
    Only non-null fields are updated, so the frontend can send partial patches.
    """
    old_signal = sim_config.signal_strength

    if payload.signal_strength is not None:
        sim_config.signal_strength = payload.signal_strength
        state["signal_strength"] = payload.signal_strength
    if payload.packet_loss is not None:
        sim_config.packet_loss = payload.packet_loss
        system_logger.sim_config_applied("packet_loss", payload.packet_loss)
    if payload.latency_ms is not None:
        sim_config.latency_ms = payload.latency_ms
        system_logger.sim_config_applied("latency_ms", payload.latency_ms)
    if payload.bus_speed_override is not None:
        sim_config.bus_speed_override = payload.bus_speed_override
        system_logger.sim_config_applied("bus_speed", payload.bus_speed_override)
    if payload.traffic_level is not None:
        sim_config.traffic_level = payload.traffic_level
        labels = {0: "Low", 1: "Medium", 2: "High"}
        system_logger.sim_config_applied("traffic", labels.get(payload.traffic_level, "?"))
    if payload.weather is not None:
        sim_config.weather = payload.weather
        labels = {0: "Clear", 1: "Cloudy", 2: "Rain"}
        system_logger.sim_config_applied("weather", labels.get(payload.weather, "?"))
    if payload.buffer_size_limit is not None:
        sim_config.buffer_size_limit = payload.buffer_size_limit
        system_logger.sim_config_applied("buffer_limit", payload.buffer_size_limit)
    if payload.interpolation_mode is not None:
        sim_config.interpolation_mode = payload.interpolation_mode
        system_logger.sim_config_applied("interpolation", payload.interpolation_mode)

    # Log signal change (special handling)
    new_signal = sim_config.signal_strength
    if old_signal != new_signal:
        system_logger.signal_changed(old_signal, new_signal)
        # Broadcast signal update immediately
        await broadcast({
            "type": "signal_update",
            "signal_strength": new_signal,
            "buffer_size": ping_buffer.size,
        })

    return {
        "status": "applied",
        "config": sim_config.to_dict(),
        "derived": sim_config.derived_values(),
    }


# ---------------------------------------------------------------------------
# GET /api/trip-status  — Current trip state
# ---------------------------------------------------------------------------

@app.get("/api/trip-status")
async def get_trip_status():
    """Return the current trip state for the ETA timeline and dashboard."""
    now = time.monotonic()
    elapsed_s = now - state["trip_start_time"] if state["trip_start_time"] else 0
    last_real_ago = now - state["last_real_ping_time"] if state["last_real_ping_time"] else 0

    bus_state = emitter.get_state()

    return {
        "current_stop_index": emitter.get_current_stop_index(),
        "stops_remaining": emitter.get_stops_remaining(),
        "elapsed_minutes": round(elapsed_s / 60, 1),
        "current_speed_kmh": round(bus_state.speed_kmh, 1),
        "distance_covered_km": round(emitter.get_distance_covered_km(), 2),
        "total_route_km": round(TOTAL_ROUTE_KM, 2),
        "buffer_count": ping_buffer.size,
        "is_ghost_mode": state["was_dead"],
        "last_real_ping_ago_seconds": round(last_real_ago, 1),
        "route_progress": round(bus_state.route_progress, 4),
    }


# ---------------------------------------------------------------------------
# GET /api/system-log  — Decision log for the dashboard
# ---------------------------------------------------------------------------

@app.get("/api/system-log")
async def get_system_log():
    """Return the last 20 system decision log entries."""
    return system_logger.get_recent(20)


# ---------------------------------------------------------------------------
# Entry point (for direct `python main.py` usage)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
