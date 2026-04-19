"""
FastAPI Backend — Phase 9: Dual-mode bus simulation.

Two completely independent simulation systems:
  LIVE — Autonomous emitters, /ws/live, no slider control
  LAB  — Slider-controlled emitters, /ws/lab, sim-config applies here only

Endpoints:
  GET  /api/routes        — road geometry for all routes
  GET  /api/buses         — current state of all buses (live)
  GET  /api/dead-zones    — dead zone definitions
  GET  /api/trip-status   — trip progress (optional ?bus_id=)
  GET  /api/system-log    — AI decision log (optional ?bus_id=)
  POST /api/signal        — set signal for a specific bus (LAB ONLY)
  POST /api/sim-config    — apply config (LAB ONLY)
  POST /api/predict-eta   — ML ETA prediction
  WS   /ws/live           — live map real-time bus stream (autonomous)
  WS   /ws/lab            — lab map real-time bus stream (slider controlled)
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

from config import ROUTES, BUSES, SimConfig, TRAFFIC_LABELS, MITAOE_DESTINATION, BusConfig
from route_builder import fetch_all_routes
from gps_emitter import (
    LiveBusEmitter, LabBusEmitter,
    get_ping_interval, get_payload_size, compute_bandwidth_saved
)
from buffer import BusBufferManager
from logger import system_logger
from dead_zones import DEAD_ZONES, get_dead_zones_for_route
from simulation_state import BusSimState, build_distance_lookup


# ── Module State ──────────────────────────────────────────────
cached_routes: Dict[str, Any] = {}
route_lookups: Dict[str, list] = {}  # route_id -> distance lookup table

# Two completely independent simulation stores
live_emitters: Dict[str, LiveBusEmitter] = {}
lab_emitters: Dict[str, LabBusEmitter] = {}

# Separate buffer managers
live_buffer_mgr: Optional[BusBufferManager] = None
lab_buffer_mgr: Optional[BusBufferManager] = None

# Lab sim config (sliders affect ONLY this)
lab_sim_config: Optional[SimConfig] = None

# Two separate WebSocket client sets
live_ws_clients: Set[WebSocket] = set()
lab_ws_clients: Set[WebSocket] = set()

# ML model
eta_model = None
BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "eta_model.pkl")
DATA_PATH = os.path.join(BASE_DIR, "historical_trips.csv")

# AI decision log (in-memory, last 100 entries)
decision_log: List[Dict] = []
MAX_LOG_SIZE = 100


# ── Auto-Setup: Generate data + train model if missing ────────

def ensure_historical_data():
    """Generate historical_trips.csv if it doesn't exist."""
    if os.path.exists(DATA_PATH):
        print(f"[OK] Historical data found: {DATA_PATH}")
        return

    print("[SETUP] Generating historical trip data...")
    from generate_historical_data import main as generate_data
    generate_data()
    print(f"[OK] Historical data generated: {DATA_PATH}")


def ensure_eta_model():
    """Train eta_model.pkl if it doesn't exist or CSV is newer."""
    needs_training = False

    if not os.path.exists(MODEL_PATH):
        needs_training = True
        print("[SETUP] ETA model not found, training required...")
    elif os.path.exists(DATA_PATH):
        # Retrain if CSV is newer than the model
        csv_mtime = os.path.getmtime(DATA_PATH)
        model_mtime = os.path.getmtime(MODEL_PATH)
        if csv_mtime > model_mtime:
            needs_training = True
            print("[SETUP] Historical data is newer than model, retraining...")

    if needs_training:
        from train_eta_model import main as train_model
        train_model()
        print(f"[OK] ETA model trained and saved.")
    else:
        print(f"[OK] ETA model found: {MODEL_PATH}")


def auto_setup():
    """Run all first-time setup steps automatically."""
    print("\n" + "=" * 55)
    print("  ZEKROM — Auto Setup")
    print("=" * 55)
    ensure_historical_data()
    ensure_eta_model()
    print("=" * 55 + "\n")


def log_decision(level: str, message: str, explanation: dict = None, is_simulated: bool = False):
    """Log an AI decision with full explanation."""
    entry = {
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "level": level,
        "message": message,
        "explanation": explanation,
        "bus_id": explanation.get("bus_id") if explanation else None,
        "is_simulated": is_simulated,
    }
    decision_log.append(entry)
    if len(decision_log) > MAX_LOG_SIZE:
        decision_log.pop(0)
    system_logger.log(level, message, explanation.get("bus_id") if explanation else None)


# ── Broadcasting ──────────────────────────────────────────────

async def broadcast_to_clients(clients: Set[WebSocket], message: Dict[str, Any]) -> None:
    """Send a message to a specific set of WS clients."""
    dead: Set[WebSocket] = set()
    for ws in clients:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    clients.difference_update(dead)


async def broadcast_live_ping(ping: dict) -> None:
    """Broadcast a position_update to LIVE clients only."""
    if ping.get("type") == "buffer_flush":
        await broadcast_to_clients(live_ws_clients, ping)
    else:
        await broadcast_to_clients(live_ws_clients, {
            "type": "position_update",
            "bus_id": ping.get("bus_id"),
            "data": ping,
            "buffer_size": ping.get("buffer_size", 0),
        })


async def broadcast_lab_ping(ping: dict) -> None:
    """Broadcast a position_update to LAB clients only."""
    if ping.get("type") == "buffer_flush":
        await broadcast_to_clients(lab_ws_clients, ping)
    else:
        await broadcast_to_clients(lab_ws_clients, {
            "type": "position_update",
            "bus_id": ping.get("bus_id"),
            "data": ping,
            "buffer_size": ping.get("buffer_size", 0),
        })


# ── Create BusSimState helper ────────────────────────────────

def create_bus_sim_state(bus_id: str) -> BusSimState:
    bus_def = BUSES[bus_id]
    return BusSimState(
        bus_id=bus_id,
        route_id=bus_def["route_id"],
        label=bus_def["label"],
        route_name=bus_def["route_name"],
        base_speed_kmh=bus_def["base_speed_kmh"],
        color=bus_def["color"],
    )


# ── Lifespan ──────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global cached_routes, route_lookups
    global live_emitters, lab_emitters
    global live_buffer_mgr, lab_buffer_mgr
    global lab_sim_config, eta_model

    # 0. Auto-setup: generate data + train model if missing
    auto_setup()

    # 1. Fetch OSRM routes
    cached_routes = fetch_all_routes(ROUTES)

    # 2. Build distance lookup tables for all routes
    for route_id, rdata in cached_routes.items():
        geometry = rdata.get("geometry", [])
        if not geometry:
            geometry = [[s["lat"], s["lng"]] for s in ROUTES[route_id]["stops"]]
        route_lookups[route_id] = build_distance_lookup(geometry)
        total_km = route_lookups[route_id][-1][0] if route_lookups[route_id] else 0
        print(f"  [OK] {route_id}: distance lookup built, total_km={total_km:.2f}")

    # 3. Create sim config (LAB ONLY)
    lab_sim_config = SimConfig()

    # 4. Create buffer managers
    bus_ids = list(BUSES.keys())
    live_buffer_mgr = BusBufferManager(bus_ids)
    lab_buffer_mgr = BusBufferManager(bus_ids)

    # 5. Create LIVE emitters (autonomous)
    for bus_id in BUSES:
        route_id = BUSES[bus_id]["route_id"]
        lookup = route_lookups.get(route_id, [])
        state = create_bus_sim_state(bus_id)

        # Set initial position
        if lookup:
            lat, lng, heading = lookup[0][1], lookup[0][2], 0.0
            state.lat = lat
            state.lng = lng
            state.last_real_lat = lat
            state.last_real_lng = lng

        route_stops = ROUTES[route_id]["stops"]
        live_emitters[bus_id] = LiveBusEmitter(
            bus_id=bus_id,
            state=state,
            lookup=lookup,
            buffer_mgr=live_buffer_mgr,
            broadcast_fn=broadcast_live_ping,
            log_fn=log_decision,
            route_stops=route_stops,
        )

    # 6. Create LAB emitters (slider controlled)
    for bus_id in BUSES:
        route_id = BUSES[bus_id]["route_id"]
        lookup = route_lookups.get(route_id, [])
        state = create_bus_sim_state(bus_id)

        if lookup:
            lat, lng, heading = lookup[0][1], lookup[0][2], 0.0
            state.lat = lat
            state.lng = lng
            state.last_real_lat = lat
            state.last_real_lng = lng

        route_stops = ROUTES[route_id]["stops"]
        lab_emitters[bus_id] = LabBusEmitter(
            bus_id=bus_id,
            state=state,
            lookup=lookup,
            sim_config=lab_sim_config,
            buffer_mgr=lab_buffer_mgr,
            broadcast_fn=broadcast_lab_ping,
            log_fn=log_decision,
            route_stops=route_stops,
        )

    print(f"[OK] Created {len(live_emitters)} LIVE + {len(lab_emitters)} LAB emitters.")

    # 7. Load ML model
    if os.path.exists(MODEL_PATH):
        eta_model = joblib.load(MODEL_PATH)
        print(f"[OK] ETA model loaded from {MODEL_PATH}")
    else:
        print(f"[WARN] ETA model not found at {MODEL_PATH}")

    # 8. Launch all emitter tasks
    tasks = []
    for bus_id, emitter in live_emitters.items():
        tasks.append(asyncio.create_task(emitter.run()))
    for bus_id, emitter in lab_emitters.items():
        tasks.append(asyncio.create_task(emitter.run()))

    heartbeat_task = asyncio.create_task(heartbeat_loop())

    print(f"[OK] System started — {len(BUSES)} buses × 2 modes = {len(tasks)} tasks active.")

    yield

    for t in tasks:
        t.cancel()
    heartbeat_task.cancel()


# ── Heartbeat ─────────────────────────────────────────────────

async def heartbeat_loop():
    try:
        while True:
            await asyncio.sleep(1)

            # Build heartbeat for LIVE
            live_hb = {}
            for bus_id, emitter in live_emitters.items():
                st = emitter.state
                live_hb[bus_id] = {
                    "signal_strength": st.signal_strength,
                    "buffer_size": st.buffer_size,
                    "is_ghost": st.is_ghost,
                    "traffic_level": st.traffic_level,
                    "confidence_score": st.eta_confidence,
                    "in_dead_zone": st.in_dead_zone,
                    "dead_zone": {"name": st.dead_zone["name"], "severity": st.dead_zone["severity"]} if st.dead_zone else None,
                    "distance_km": round(st.distance_traveled_km, 3),
                }
            await broadcast_to_clients(live_ws_clients, {
                "type": "heartbeat",
                "buses": live_hb,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            # Build heartbeat for LAB
            lab_hb = {}
            for bus_id, emitter in lab_emitters.items():
                st = emitter.state
                lab_hb[bus_id] = {
                    "signal_strength": st.signal_strength,
                    "buffer_size": st.buffer_size,
                    "is_ghost": st.is_ghost,
                    "traffic_level": st.traffic_level,
                    "confidence_score": st.eta_confidence,
                    "in_dead_zone": st.in_dead_zone,
                    "dead_zone": {"name": st.dead_zone["name"], "severity": st.dead_zone["severity"]} if st.dead_zone else None,
                    "distance_km": round(st.distance_traveled_km, 3),
                }
            await broadcast_to_clients(lab_ws_clients, {
                "type": "heartbeat",
                "buses": lab_hb,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

    except asyncio.CancelledError:
        pass


# ── FastAPI App ───────────────────────────────────────────────

app = FastAPI(title="Zekrom API", version="9.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket Endpoints ──────────────────────────────────────

def _build_init_payload(emitters_dict: Dict):
    """Build the init payload from a set of emitters."""
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
    for bus_id, emitter in emitters_dict.items():
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
            "last_ping": emitter._build_ping(st.signal_strength, st.dead_zone, None),
        }

    return {
        "type": "init",
        "routes": routes_payload,
        "buses": buses_payload,
        "dead_zones": DEAD_ZONES,
        "mitaoe": MITAOE_DESTINATION,
    }


@app.websocket("/ws/live")
async def ws_live_endpoint(websocket: WebSocket):
    """Live map connection — autonomous simulation, no slider control."""
    await websocket.accept()
    live_ws_clients.add(websocket)

    try:
        await websocket.send_json(_build_init_payload(live_emitters))
    except Exception:
        live_ws_clients.discard(websocket)
        return

    try:
        while True:
            await websocket.receive_text()  # keep alive
    except (WebSocketDisconnect, Exception):
        live_ws_clients.discard(websocket)


@app.websocket("/ws/lab")
async def ws_lab_endpoint(websocket: WebSocket):
    """Lab map connection — slider controlled simulation."""
    await websocket.accept()
    lab_ws_clients.add(websocket)

    try:
        await websocket.send_json(_build_init_payload(lab_emitters))
    except Exception:
        lab_ws_clients.discard(websocket)
        return

    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        lab_ws_clients.discard(websocket)


# Backwards compatibility — /ws/client redirects to /ws/live
@app.websocket("/ws/client")
async def ws_client_endpoint(websocket: WebSocket):
    """Legacy endpoint — forwards to live simulation."""
    await websocket.accept()
    live_ws_clients.add(websocket)

    try:
        await websocket.send_json(_build_init_payload(live_emitters))
    except Exception:
        live_ws_clients.discard(websocket)
        return

    try:
        while True:
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        live_ws_clients.discard(websocket)


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
    """Returns LIVE bus states."""
    result = {}
    for bus_id, emitter in live_emitters.items():
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
            "distance_km": round(st.distance_traveled_km, 3),
            "last_ping": emitter._build_ping(st.signal_strength, st.dead_zone, None),
        }
    return result


@app.get("/api/dead-zones")
async def get_dead_zones():
    """Return all dead zone definitions with route geometry segments."""
    result = []
    for dz in DEAD_ZONES:
        entry = {**dz}
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
    """Only updates LAB configs — never LIVE configs."""
    data = payload.dict(exclude_none=True)
    bus_id = data.pop("bus_id", None)
    lab_sim_config.update(data, bus_id)
    return {"status": "applied", "scope": "lab_only", "bus_id": bus_id}


class SignalRequest(BaseModel):
    strength: int = Field(..., ge=0, le=100)
    bus_id: Optional[str] = None


@app.post("/api/signal")
async def set_signal(payload: SignalRequest):
    """Only updates LAB signal — LIVE signal is autonomous."""
    lab_sim_config.update({"signal_strength": payload.strength}, payload.bus_id)
    return {"signal_strength": payload.strength, "bus_id": payload.bus_id, "scope": "lab_only"}


@app.get("/api/trip-status")
async def get_trip_status(bus_id: Optional[str] = Query(None)):
    """Returns trip status from LIVE emitters."""
    target_ids = [bus_id] if bus_id else list(live_emitters.keys())
    result = {}
    for bid in target_ids:
        em = live_emitters.get(bid)
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
            "distance_covered_km": round(st.distance_traveled_km, 2),
            "total_route_km": route_data.get("distance_km", 0),
            "buffer_count": st.buffer_size,
            "is_ghost": st.is_ghost,
            "route_progress": round(st.route_progress, 4),
            "confidence_score": st.eta_confidence,
            "in_dead_zone": st.in_dead_zone,
            "trip_number": st.trip_number,
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


@app.get("/api/layer-status/{bus_id}")
async def get_layer_status(bus_id: str):
    """Return the current computed state of all 6 layers for a specific bus (from LAB)."""
    emitter = lab_emitters.get(bus_id)
    if not emitter:
        return {"error": f"Bus {bus_id} not found"}

    st = emitter.state
    cfg = lab_sim_config.get_bus_config(bus_id)
    signal = st.signal_strength
    prev_signal = st.prev_signal
    signal_delta = abs(signal - prev_signal)

    layer1_active = signal_delta > 15 or cfg.packet_loss > 20 or cfg.latency_ms > 500
    layer2_active = signal < 10 or st.buffer_size > 0 or st.is_flushing
    layer3_active = st.is_ghost
    layer4_active = st.eta_just_recalculated or st.is_ghost
    layer5_active = st.approaching_dead_zone or st.in_dead_zone
    layer6_active = cfg.latency_ms > 200

    return {
        "bus_id": bus_id,
        "monitored_at": datetime.now(timezone.utc).isoformat(),
        "layers": {
            "layer1": {
                "active": layer1_active,
                "data": {
                    "ping_interval_ms": int(get_ping_interval(signal) * 1000),
                    "payload_size_bytes": get_payload_size(signal),
                    "bandwidth_saved_pct": compute_bandwidth_saved(signal),
                    "prev_signal": prev_signal,
                    "signal": signal,
                    "payload_history": list(st.payload_history),
                }
            },
            "layer2": {
                "active": layer2_active,
                "data": {
                    "buffer_count": st.buffer_size,
                    "buffer_max": cfg.buffer_size_limit,
                    "is_flushing": st.is_flushing,
                    "flush_progress": st.flush_progress,
                    "recent_buffered_pings": list(st.recent_buffered_pings),
                }
            },
            "layer3": {
                "active": layer3_active,
                "data": {
                    "ghost_confidence": st.ghost_confidence,
                    "ghost_confidence_history": list(st.ghost_confidence_history),
                    "ghost_distance_km": round(st.ghost_distance_display_km, 3),
                    "last_real_speed": round(st.last_real_speed_kmh, 1),
                    "last_real_heading": round(st.last_real_heading, 1),
                    "reconciliation_deviation_m": st.reconciliation_deviation_m,
                    "time_since_real_ping": round(time.time() - st.last_real_ping_time, 1),
                }
            },
            "layer4": {
                "active": layer4_active,
                "data": {
                    "eta_data_mode": st.eta_data_mode,
                    "eta_cone_width": st.eta_cone_width,
                    "eta_confidence": st.eta_confidence,
                }
            },
            "layer5": {
                "active": layer5_active,
                "data": {
                    "approaching": st.approaching_dead_zone,
                    "in_zone": st.in_dead_zone,
                    "next_zone": st.next_dead_zone_info,
                    "distance_km": st.distance_to_dead_zone_km,
                    "dead_zone_progress_pct": st.dead_zone_progress_pct,
                    "pre_arming_complete": st.pre_arming_complete,
                    "time_in_zone_s": round(time.time() - st.dead_zone_start_time, 1) if st.dead_zone_start_time else 0,
                }
            },
            "layer6": {
                "active": layer6_active,
                "data": {
                    "latency_ms": cfg.latency_ms,
                    "missed_pings": st.missed_pings_session,
                }
            },
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
