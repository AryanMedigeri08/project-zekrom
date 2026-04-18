"""
FastAPI Backend — Phase 5: 5 buses, dead zones, AI explainability.

Startup:
  1. Fetch OSRM road geometry for 5 routes (cached)
  2. Create 5 BusEmitter instances
  3. Launch 5 independent async simulation tasks

Endpoints:
  GET  /api/routes        — road geometry for all routes
  GET  /api/buses         — current state of all buses
  GET  /api/dead-zones    — dead zone definitions
  GET  /api/trip-status   — trip progress (optional ?bus_id=)
  GET  /api/system-log    — AI decision log (optional ?bus_id=)
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

from config import ROUTES, BUSES, SimConfig, TRAFFIC_LABELS, MITAOE_DESTINATION
from route_builder import fetch_all_routes
from gps_emitter import BusEmitter
from buffer import BusBufferManager
from logger import system_logger
from dead_zones import DEAD_ZONES, get_dead_zones_for_route


# ── Module State ──────────────────────────────────────────────
cached_routes: Dict[str, Any] = {}
bus_emitters: Dict[str, BusEmitter] = {}
buffer_mgr: Optional[BusBufferManager] = None
sim_config: Optional[SimConfig] = None
connected_clients: Set[WebSocket] = set()
eta_model = None
MODEL_PATH = os.path.join(os.path.dirname(__file__), "eta_model.pkl")

# AI decision log (in-memory, last 100 entries)
decision_log: List[Dict] = []
MAX_LOG_SIZE = 100


def log_decision(level: str, message: str, explanation: dict = None):
    """Log an AI decision with full explanation."""
    entry = {
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "level": level,
        "message": message,
        "explanation": explanation,
        "bus_id": explanation.get("bus_id") if explanation else None,
    }
    decision_log.append(entry)
    if len(decision_log) > MAX_LOG_SIZE:
        decision_log.pop(0)
    system_logger.log(level, message, explanation.get("bus_id") if explanation else None)


# ── Broadcasting ──────────────────────────────────────────────
async def broadcast_msg(message: Dict[str, Any]) -> None:
    dead: Set[WebSocket] = set()
    for ws in connected_clients:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


async def broadcast_ping(ping: dict) -> None:
    """Broadcast a position_update message."""
    if ping.get("type") == "buffer_flush":
        await broadcast_msg(ping)
    else:
        await broadcast_msg({
            "type": "position_update",
            "bus_id": ping.get("bus_id"),
            "data": ping,
            "buffer_size": ping.get("buffer_size", 0),
        })


# ── Lifespan ──────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global cached_routes, bus_emitters, buffer_mgr, sim_config, eta_model

    # 1. Fetch OSRM routes for all 5 routes
    cached_routes = fetch_all_routes(ROUTES)

    # 2. Create sim config
    sim_config = SimConfig()

    # 3. Create buffer manager
    buffer_mgr = BusBufferManager(list(BUSES.keys()))

    # 4. Create emitters
    for bus_id in BUSES:
        route_id = BUSES[bus_id]["route_id"]
        geometry = cached_routes.get(route_id, {}).get("geometry", [])
        if not geometry:
            # Fallback: use stop coordinates
            geometry = [[s["lat"], s["lng"]] for s in ROUTES[route_id]["stops"]]
        bus_emitters[bus_id] = BusEmitter(
            bus_id=bus_id,
            geometry=geometry,
            sim_config=sim_config,
            buffer_mgr=buffer_mgr,
            broadcast_fn=broadcast_ping,
            log_fn=log_decision,
        )
    print(f"[OK] Created {len(bus_emitters)} bus emitters.")

    # 5. Load ML model
    if os.path.exists(MODEL_PATH):
        eta_model = joblib.load(MODEL_PATH)
        print(f"[OK] ETA model loaded from {MODEL_PATH}")
    else:
        print(f"[WARN] ETA model not found at {MODEL_PATH}")

    # 6. Launch tasks
    tasks = []
    for bus_id, emitter in bus_emitters.items():
        tasks.append(asyncio.create_task(emitter.run()))
    heartbeat_task = asyncio.create_task(heartbeat_loop())

    print(f"[OK] System started — {len(BUSES)} buses active.")

    yield

    for t in tasks:
        t.cancel()
    heartbeat_task.cancel()


# ── Heartbeat ─────────────────────────────────────────────────

async def heartbeat_loop():
    try:
        while True:
            await asyncio.sleep(1)
            buses_hb = {}
            for bus_id, emitter in bus_emitters.items():
                st = emitter.state
                buses_hb[bus_id] = {
                    "signal_strength": st.signal_strength,
                    "buffer_size": st.buffer_size,
                    "is_ghost": st.is_ghost,
                    "traffic_level": st.traffic_level,
                    "confidence_score": st.eta_confidence,
                    "in_dead_zone": st.in_dead_zone,
                    "dead_zone": {"name": st.dead_zone["name"], "severity": st.dead_zone["severity"]} if st.dead_zone else None,
                }
            await broadcast_msg({
                "type": "heartbeat",
                "buses": buses_hb,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    except asyncio.CancelledError:
        pass


# ── FastAPI App ───────────────────────────────────────────────

app = FastAPI(title="Resilient Transport Tracker", version="5.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket ─────────────────────────────────────────────────

@app.websocket("/ws/client")
async def ws_client_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)

    # Build init payload
    routes_payload = {}
    for route_id, rdata in cached_routes.items():
        routes_payload[route_id] = {
            "name": rdata.get("name", ""),
            "color": ROUTES[route_id]["color"],
            "stops": rdata.get("stops", ROUTES[route_id]["stops"]),
            "geometry": rdata.get("geometry", []),
            "distance_km": rdata.get("distance_km", 0),
            "dead_zones": get_dead_zones_for_route(route_id),
        }

    buses_payload = {}
    for bus_id, emitter in bus_emitters.items():
        st = emitter.state
        bus_def = BUSES[bus_id]
        buses_payload[bus_id] = {
            "id": bus_id,
            "route_id": bus_def["route_id"],
            "label": bus_def["label"],
            "route_name": bus_def["route_name"],
            "color": bus_def["color"],
            "signal_strength": st.signal_strength,
            "traffic_level": st.traffic_level,
            "is_ghost": st.is_ghost,
            "buffer_size": st.buffer_size,
            "last_ping": emitter._build_ping(),
        }

    try:
        await websocket.send_json({
            "type": "init",
            "routes": routes_payload,
            "buses": buses_payload,
            "dead_zones": DEAD_ZONES,
            "mitaoe": MITAOE_DESTINATION,
        })
    except Exception:
        connected_clients.discard(websocket)
        return

    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        connected_clients.discard(websocket)


# ── REST Endpoints ────────────────────────────────────────────

@app.get("/api/routes")
async def get_routes():
    result = {}
    for route_id, rdata in cached_routes.items():
        result[route_id] = {
            "name": rdata.get("name", ""),
            "color": ROUTES[route_id]["color"],
            "stops": rdata.get("stops", ROUTES[route_id]["stops"]),
            "geometry": rdata.get("geometry", []),
            "distance_km": rdata.get("distance_km", 0),
            "dead_zones": get_dead_zones_for_route(route_id),
        }
    return result


@app.get("/api/buses")
async def get_buses():
    result = {}
    for bus_id, emitter in bus_emitters.items():
        st = emitter.state
        bus_def = BUSES[bus_id]
        result[bus_id] = {
            "id": bus_id,
            "route_id": bus_def["route_id"],
            "label": bus_def["label"],
            "route_name": bus_def["route_name"],
            "color": bus_def["color"],
            "signal_strength": st.signal_strength,
            "traffic_level": st.traffic_level,
            "is_ghost": st.is_ghost,
            "buffer_size": st.buffer_size,
            "confidence_score": st.eta_confidence,
            "in_dead_zone": st.in_dead_zone,
            "last_ping": emitter._build_ping(),
        }
    return result


@app.get("/api/dead-zones")
async def get_dead_zones():
    """Return all dead zone definitions with route geometry segments."""
    result = []
    for dz in DEAD_ZONES:
        entry = {**dz}
        # Add geometry segments for each affected route
        segments = []
        for rid in dz["route_ids"]:
            route_stops = ROUTES.get(rid, {}).get("stops", [])
            for si in dz["affected_stop_indices"]:
                if si < len(route_stops) and si + 1 < len(route_stops):
                    segments.append({
                        "route_id": rid,
                        "from_stop": route_stops[si],
                        "to_stop": route_stops[si + 1],
                    })
        entry["segments"] = segments
        result.append(entry)
    return result


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
    data = payload.dict(exclude_none=True)
    bus_id = data.pop("bus_id", None)
    sim_config.update(data, bus_id)
    return {"status": "applied", "bus_id": bus_id}


class SignalRequest(BaseModel):
    strength: int = Field(..., ge=0, le=100)
    bus_id: Optional[str] = None


@app.post("/api/signal")
async def set_signal(payload: SignalRequest):
    sim_config.update({"signal_strength": payload.strength}, payload.bus_id)
    return {"signal_strength": payload.strength, "bus_id": payload.bus_id}


@app.get("/api/trip-status")
async def get_trip_status(bus_id: Optional[str] = Query(None)):
    target_ids = [bus_id] if bus_id else list(bus_emitters.keys())
    result = {}
    for bid in target_ids:
        em = bus_emitters.get(bid)
        if not em:
            continue
        st = em.state
        route_data = cached_routes.get(st.route_id, {})
        total_stops = len(ROUTES[st.route_id]["stops"])
        result[bid] = {
            "bus_id": bid,
            "label": st.label,
            "route_id": st.route_id,
            "current_stop_index": st.stop_index,
            "stops_remaining": max(0, total_stops - st.stop_index - 1),
            "next_stop": ROUTES[st.route_id]["stops"][min(st.stop_index + 1, total_stops - 1)]["name"],
            "current_speed_kmh": round(st.speed_kmh, 1),
            "distance_covered_km": round(route_data.get("distance_km", 0) * st.route_progress, 2),
            "total_route_km": route_data.get("distance_km", 0),
            "buffer_count": st.buffer_size,
            "is_ghost": st.is_ghost,
            "route_progress": round(st.route_progress, 4),
            "confidence_score": st.eta_confidence,
            "in_dead_zone": st.in_dead_zone,
        }
    return result


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
    lo_arrival = now + timedelta(minutes=max(0, predicted - margin))
    hi_arrival = now + timedelta(minutes=predicted + margin)

    return {
        "predicted_remaining_minutes": round(predicted, 1),
        "predicted_arrival_time": arrival.strftime("%H:%M"),
        "arrival_range_low": lo_arrival.strftime("%H:%M"),
        "arrival_range_high": hi_arrival.strftime("%H:%M"),
        "confidence_low": round(max(0, predicted - margin), 1),
        "confidence_high": round(predicted + margin, 1),
        "confidence_margin_minutes": round(margin, 1),
        "confidence_width": width_label,
        "signal_penalty_applied": sig < 40,
        "model_version": "gradient_boosting_v1" if eta_model else "heuristic_fallback",
        "bus_id": req.bus_id,
    }


@app.get("/api/system-log")
async def get_system_log(bus_id: Optional[str] = Query(None)):
    if bus_id:
        return [e for e in decision_log if e.get("bus_id") == bus_id][-20:]
    return decision_log[-20:]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
