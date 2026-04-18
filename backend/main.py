"""
FastAPI Backend — Phase 3: Multi-bus, road-following routes.

Startup:
  1. Fetch OSRM road geometry for 3 routes (cached)
  2. Create 3 BusEmitter instances
  3. Launch 3 independent async simulation tasks

Endpoints:
  GET  /api/routes        — road geometry for all routes
  GET  /api/buses         — current state of all buses
  GET  /api/trip-status   — trip progress (optional ?bus_id=)
  GET  /api/system-log    — decision log (optional ?bus_id=)
  POST /api/signal        — set signal for a specific bus
  POST /api/sim-config    — apply config (optional bus_id field)
  POST /api/predict-eta   — ML ETA prediction
  WS   /ws/client         — real-time bus position stream
"""

import asyncio
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
    ROUTE_DEFINITIONS,
    BUS_DEFINITIONS,
    bus_configs,
    sim_config,
    SIMULATION_TICK_S,
    HEARTBEAT_INTERVAL_S,
    get_effective_ping_interval,
    get_traffic_label,
)
from route_builder import fetch_all_routes
from gps_emitter import BusEmitter, create_emitters
from buffer import BusBufferManager
from logger import system_logger


# ---------------------------------------------------------------------------
# Module-Level State
# ---------------------------------------------------------------------------

cached_routes: Dict[str, Any] = {}          # route_id -> { geometry, stops, ... }
emitters: Dict[str, BusEmitter] = {}        # bus_id -> BusEmitter
buffer_mgr: Optional[BusBufferManager] = None
connected_clients: Set[WebSocket] = set()

# Per-bus runtime state
bus_state: Dict[str, Dict[str, Any]] = {}   # bus_id -> { last_ping, last_emit_time, ... }

# ML Model
eta_model = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), "eta_model.pkl")


def init_bus_state():
    """Initialize runtime state dict for each bus."""
    global bus_state
    now = time.monotonic()
    for bus_id in BUS_DEFINITIONS:
        bus_state[bus_id] = {
            "last_ping": None,
            "last_emit_time": 0.0,
            "last_real_ping_time": 0.0,
            "was_dead": False,
            "trip_start_time": now,
        }


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global cached_routes, emitters, buffer_mgr, eta_model

    # 1. Fetch OSRM routes
    cached_routes = fetch_all_routes(ROUTE_DEFINITIONS)

    # 2. Create emitters
    emitters = create_emitters(cached_routes)
    print(f"✓ Created {len(emitters)} bus emitters.")

    # 3. Create per-bus buffers
    buffer_mgr = BusBufferManager(list(BUS_DEFINITIONS.keys()))

    # 4. Init state
    init_bus_state()

    # 5. Load ML model
    if os.path.exists(MODEL_PATH):
        eta_model = joblib.load(MODEL_PATH)
        print(f"✓ ETA model loaded from {MODEL_PATH}")
        system_logger.info("ETA model loaded.")
    else:
        print(f"⚠ ETA model not found at {MODEL_PATH}")
        system_logger.warn("ETA model not found. Predictions will use heuristic.")

    system_logger.info("System started — 3 buses active.")

    # 6. Launch tasks
    tasks = []
    for bus_id in emitters:
        tasks.append(asyncio.create_task(bus_simulation_loop(bus_id)))
    heartbeat_task = asyncio.create_task(heartbeat_loop())

    yield

    # Cleanup
    for t in tasks:
        t.cancel()
    heartbeat_task.cancel()


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(title="Resilient Transport Tracker", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Broadcasting
# ---------------------------------------------------------------------------

async def broadcast(message: Dict[str, Any]) -> None:
    dead: Set[WebSocket] = set()
    for ws in connected_clients:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


# ---------------------------------------------------------------------------
# Per-Bus Simulation Loop
# ---------------------------------------------------------------------------

async def bus_simulation_loop(bus_id: str) -> None:
    """Independent simulation task for one bus. Crash-isolated."""
    emitter = emitters[bus_id]
    bstate = bus_state[bus_id]
    bcfg = bus_configs[bus_id]

    try:
        while True:
            await asyncio.sleep(SIMULATION_TICK_S)

            # 1. Physics
            emitter.update(SIMULATION_TICK_S)

            # 2. Signal with drift
            effective_signal = emitter.drift_signal()

            # 3. Build ping
            interval = get_effective_ping_interval(effective_signal, sim_config.packet_loss)
            now = time.monotonic()

            if interval is None:
                # Dead zone — buffer
                ping = emitter.create_ping(effective_signal, ping_type="ghost")
                bstate["last_ping"] = ping

                if buffer_mgr.size(bus_id) < sim_config.buffer_size_limit:
                    buffer_mgr.store(bus_id, emitter.create_ping(effective_signal, ping_type="buffered"))
                system_logger.buffer_storing(bus_id, buffer_mgr.size(bus_id))

                if not bstate["was_dead"]:
                    system_logger.ghost_activated(bus_id)
                bstate["was_dead"] = True

                # Broadcast ghost ping so marker appears translucent
                await broadcast({
                    "type": "position_update",
                    "bus_id": bus_id,
                    "data": ping,
                    "buffer_size": buffer_mgr.size(bus_id),
                })
            else:
                # Signal recovered — flush buffer first
                if bstate["was_dead"] and buffer_mgr.size(bus_id) > 0:
                    flushed = buffer_mgr.flush(bus_id)
                    await broadcast({
                        "type": "buffer_flush",
                        "bus_id": bus_id,
                        "pings": flushed,
                        "buffer_size": 0,
                    })
                    system_logger.buffer_flushed(bus_id, len(flushed))
                    system_logger.ghost_deactivated(bus_id)
                bstate["was_dead"] = False

                # Normal emit at tier cadence
                if now - bstate["last_emit_time"] >= interval:
                    bstate["last_emit_time"] = now
                    bstate["last_real_ping_time"] = now
                    ping = emitter.create_ping(effective_signal, ping_type="real")
                    bstate["last_ping"] = ping

                    await broadcast({
                        "type": "position_update",
                        "bus_id": bus_id,
                        "data": ping,
                        "buffer_size": buffer_mgr.size(bus_id),
                    })

    except asyncio.CancelledError:
        pass
    except Exception as e:
        system_logger.critical(f"[{bus_id}] Emitter crashed: {e}", bus_id)
        print(f"ERROR: Bus {bus_id} emitter crashed: {e}")


# ---------------------------------------------------------------------------
# Heartbeat Loop (all buses at once)
# ---------------------------------------------------------------------------

async def heartbeat_loop() -> None:
    try:
        while True:
            await asyncio.sleep(HEARTBEAT_INTERVAL_S)
            buses_heartbeat = {}
            for bus_id in BUS_DEFINITIONS:
                ping = bus_state.get(bus_id, {}).get("last_ping")
                bcfg = bus_configs.get(bus_id)
                effective_signal = ping["signal_strength"] if ping else (bcfg.signal_strength if bcfg else 85)
                buses_heartbeat[bus_id] = {
                    "signal_strength": effective_signal,
                    "buffer_size": buffer_mgr.size(bus_id) if buffer_mgr else 0,
                    "is_ghost": bus_state.get(bus_id, {}).get("was_dead", False),
                    "traffic_level": get_traffic_label(bcfg.traffic_level) if bcfg else "medium",
                }

            await broadcast({
                "type": "heartbeat",
                "buses": buses_heartbeat,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    except asyncio.CancelledError:
        pass


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws/client")
async def ws_client_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)

    # Send init with routes + current bus states
    routes_payload = {}
    for route_id, rdata in cached_routes.items():
        routes_payload[route_id] = {
            "name": rdata["name"],
            "color_id": rdata["color_id"],
            "stops": rdata["stops"],
            "geometry": rdata["geometry"],
            "stop_indices": rdata["stop_indices"],
            "distance_km": rdata["distance_km"],
        }

    buses_payload = {}
    for bus_id, bdef in BUS_DEFINITIONS.items():
        buses_payload[bus_id] = {
            "id": bus_id,
            "route_id": bdef["route_id"],
            "label": bdef["label"],
            "last_ping": bus_state.get(bus_id, {}).get("last_ping"),
            "signal_strength": bus_configs[bus_id].signal_strength,
            "traffic_level": get_traffic_label(bus_configs[bus_id].traffic_level),
            "is_ghost": bus_state.get(bus_id, {}).get("was_dead", False),
            "buffer_size": buffer_mgr.size(bus_id) if buffer_mgr else 0,
        }

    try:
        await websocket.send_json({
            "type": "init",
            "routes": routes_payload,
            "buses": buses_payload,
        })
    except Exception:
        connected_clients.discard(websocket)
        return

    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        connected_clients.discard(websocket)


# ═══════════════════════════════════════════════════════════════════════
# REST Endpoints
# ═══════════════════════════════════════════════════════════════════════

@app.get("/api/routes")
async def get_routes():
    result = {}
    for route_id, rdata in cached_routes.items():
        result[route_id] = {
            "name": rdata["name"],
            "color_id": rdata["color_id"],
            "stops": rdata["stops"],
            "geometry": rdata["geometry"],
            "stop_indices": rdata["stop_indices"],
            "distance_km": rdata["distance_km"],
        }
    return result


@app.get("/api/buses")
async def get_buses():
    result = {}
    for bus_id, bdef in BUS_DEFINITIONS.items():
        bcfg = bus_configs[bus_id]
        result[bus_id] = {
            "id": bus_id,
            "route_id": bdef["route_id"],
            "label": bdef["label"],
            "base_speed_kmh": bdef["base_speed_kmh"],
            "signal_strength": bcfg.signal_strength,
            "traffic_level": get_traffic_label(bcfg.traffic_level),
            "is_ghost": bus_state.get(bus_id, {}).get("was_dead", False),
            "buffer_size": buffer_mgr.size(bus_id) if buffer_mgr else 0,
            "last_ping": bus_state.get(bus_id, {}).get("last_ping"),
        }
    return result


# Signal for a specific bus
class SignalRequest(BaseModel):
    strength: int = Field(..., ge=0, le=100)
    bus_id: Optional[str] = None


@app.post("/api/signal")
async def set_signal(payload: SignalRequest):
    targets = [payload.bus_id] if payload.bus_id else list(BUS_DEFINITIONS.keys())
    for bid in targets:
        if bid in bus_configs:
            old = bus_configs[bid].signal_strength
            bus_configs[bid].signal_strength = payload.strength
            if old != payload.strength:
                system_logger.signal_changed(bid, old, payload.strength)
    return {"signal_strength": payload.strength, "targets": targets}


# Sim Config (with optional bus_id for per-bus targeting)
class SimConfigRequest(BaseModel):
    bus_id: Optional[str] = None
    signal_strength: Optional[int] = Field(None, ge=0, le=100)
    packet_loss: Optional[int] = Field(None, ge=0, le=50)
    latency_ms: Optional[int] = Field(None, ge=0, le=2000)
    traffic_level: Optional[int] = Field(None, ge=0, le=2)
    weather: Optional[int] = Field(None, ge=0, le=2)
    buffer_size_limit: Optional[int] = Field(None, ge=10, le=200)
    interpolation_mode: Optional[str] = None
    bus_speed_override: Optional[float] = Field(None, ge=0, le=80)


@app.post("/api/sim-config")
async def update_sim_config(payload: SimConfigRequest):
    targets = [payload.bus_id] if payload.bus_id else list(BUS_DEFINITIONS.keys())

    # Per-bus settings
    if payload.signal_strength is not None:
        for bid in targets:
            if bid in bus_configs:
                old = bus_configs[bid].signal_strength
                bus_configs[bid].signal_strength = payload.signal_strength
                if old != payload.signal_strength:
                    system_logger.signal_changed(bid, old, payload.signal_strength)

    if payload.traffic_level is not None:
        for bid in targets:
            if bid in bus_configs:
                bus_configs[bid].traffic_level = payload.traffic_level
        system_logger.sim_config_applied("traffic", get_traffic_label(payload.traffic_level), payload.bus_id)

    # Global settings
    if payload.packet_loss is not None:
        sim_config.packet_loss = payload.packet_loss
        system_logger.sim_config_applied("packet_loss", payload.packet_loss, payload.bus_id)
    if payload.latency_ms is not None:
        sim_config.latency_ms = payload.latency_ms
        system_logger.sim_config_applied("latency", payload.latency_ms, payload.bus_id)
    if payload.weather is not None:
        sim_config.weather = payload.weather
        labels = {0: "Clear", 1: "Cloudy", 2: "Rain"}
        system_logger.sim_config_applied("weather", labels.get(payload.weather), payload.bus_id)
    if payload.buffer_size_limit is not None:
        sim_config.buffer_size_limit = payload.buffer_size_limit
        if buffer_mgr:
            buffer_mgr.set_all_max_size(payload.buffer_size_limit)
        system_logger.sim_config_applied("buffer_limit", payload.buffer_size_limit, payload.bus_id)
    if payload.interpolation_mode is not None:
        sim_config.interpolation_mode = payload.interpolation_mode

    # Build response
    per_bus = {}
    for bid in targets:
        bcfg = bus_configs.get(bid)
        if bcfg:
            per_bus[bid] = {
                "signal_strength": bcfg.signal_strength,
                "traffic_level": get_traffic_label(bcfg.traffic_level),
            }

    return {
        "status": "applied",
        "targets": targets,
        "global_config": sim_config.to_dict(),
        "bus_configs": per_bus,
    }


# Trip status
@app.get("/api/trip-status")
async def get_trip_status(bus_id: Optional[str] = Query(None)):
    target_ids = [bus_id] if bus_id else list(emitters.keys())
    result = {}
    for bid in target_ids:
        em = emitters.get(bid)
        bs = bus_state.get(bid, {})
        if not em:
            continue
        now = time.monotonic()
        elapsed = now - bs.get("trip_start_time", now)
        route_data = cached_routes.get(em.route_id, {})
        result[bid] = {
            "bus_id": bid,
            "label": em.label,
            "route_id": em.route_id,
            "current_stop_index": em.get_current_stop_index(),
            "stops_remaining": em.get_stops_remaining(),
            "next_stop": em.get_next_stop_name(),
            "elapsed_minutes": round(elapsed / 60, 1),
            "current_speed_kmh": round(em._speed_kmh, 1),
            "distance_covered_km": round(em.get_distance_covered_km(), 2),
            "total_route_km": route_data.get("distance_km", 0),
            "buffer_count": buffer_mgr.size(bid) if buffer_mgr else 0,
            "is_ghost": bs.get("was_dead", False),
            "route_progress": round(em.get_route_progress(), 4),
        }
    return result


# ETA Prediction
class ETARequest(BaseModel):
    departure_time: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    traffic_level: int = Field(..., ge=0, le=2)
    avg_signal_strength: int = Field(..., ge=0, le=100)
    weather: int = Field(..., ge=0, le=2)
    num_passengers_approx: int = Field(35, ge=10, le=60)
    elapsed_minutes: float = Field(0.0, ge=0)
    current_stop_index: int = Field(0, ge=0)
    bus_id: Optional[str] = None


@app.post("/api/predict-eta")
async def predict_eta(req: ETARequest):
    if eta_model is None:
        predicted = max(0, 28.0 - req.elapsed_minutes)
    else:
        features = np.array([[
            req.departure_time, req.day_of_week, req.traffic_level,
            req.avg_signal_strength, req.weather, req.num_passengers_approx,
        ]])
        predicted = max(0, float(eta_model.predict(features)[0]) - req.elapsed_minutes)

    sig = req.avg_signal_strength
    if sig >= 70:
        margin_pct, width_label = 0.15, "narrow"
    elif sig >= 40:
        margin_pct, width_label = 0.25, "medium"
    else:
        margin_pct, width_label = 0.40, "wide"

    margin = predicted * margin_pct
    now = datetime.now()
    arrival = now + timedelta(minutes=predicted)

    return {
        "predicted_remaining_minutes": round(predicted, 1),
        "predicted_arrival_time": arrival.strftime("%H:%M"),
        "confidence_low": round(max(0, predicted - margin), 1),
        "confidence_high": round(predicted + margin, 1),
        "confidence_width": width_label,
        "signal_penalty_applied": sig < 40,
        "model_version": "gradient_boosting_v1" if eta_model else "heuristic_fallback",
        "bus_id": req.bus_id,
    }


# System Log
@app.get("/api/system-log")
async def get_system_log(bus_id: Optional[str] = Query(None)):
    return system_logger.get_recent(20, bus_id)


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
