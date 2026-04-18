"""
gps_emitter.py — Phase 5: Multi-bus emitter with dead zones, ghost mode, explainability.

Each BusEmitter runs as an independent asyncio task.
Ghost pings are ALWAYS emitted when signal < 10%, following road geometry.
Dead zones override signal strength based on stop_index.
"""

import asyncio
import random
import time
import math
import json
from typing import Optional
from config import BUSES, ROUTES, SimConfig, TRAFFIC_LABELS
from dead_zones import get_active_dead_zone, compute_confidence_score
from explainer import explainer
from buffer import BusBufferManager


class BusState:
    """Mutable per-bus runtime state."""

    def __init__(self, bus_id: str, route_geometry: list):
        bus_def = BUSES[bus_id]
        self.bus_id = bus_id
        self.label = bus_def["label"]
        self.route_id = bus_def["route_id"]
        self.route_name = bus_def["route_name"]
        self.color = bus_def["color"]
        self.base_speed = bus_def["base_speed_kmh"]

        self.route_geometry = route_geometry  # [[lat, lng], ...]
        self.geometry_index = 0
        self.stop_index = 0
        self.route_progress = 0.0

        self.lat = route_geometry[0][0] if route_geometry else 0
        self.lng = route_geometry[0][1] if route_geometry else 0
        self.speed_kmh = self.base_speed
        self.heading_degrees = 0.0

        self.signal_strength = 85
        self.prev_signal = 85
        self.traffic_level = "medium"
        self.is_ghost = False
        self.ghost_confidence = 1.0
        self.ping_type = "real"
        self.buffer_size = 0

        self.last_real_ping_time = time.time()
        self.last_real_lat = self.lat
        self.last_real_lng = self.lng
        self.last_speed = self.base_speed
        self.last_heading = 0.0
        self.blackout_start_time = None

        self.dead_zone = None
        self.in_dead_zone = False
        self.explanation = None
        self.eta_confidence = 0.8


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _bearing(lat1, lng1, lat2, lng2) -> float:
    dlng = math.radians(lng2 - lng1)
    lat1r, lat2r = math.radians(lat1), math.radians(lat2)
    x = math.sin(dlng) * math.cos(lat2r)
    y = math.cos(lat1r) * math.sin(lat2r) - math.sin(lat1r) * math.cos(lat2r) * math.cos(dlng)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _compute_stop_index(lat, lng, stops: list) -> int:
    """Find the closest stop index that the bus has passed."""
    min_dist = float("inf")
    closest = 0
    for i, s in enumerate(stops):
        d = _haversine_km(lat, lng, s["lat"], s["lng"])
        if d < min_dist:
            min_dist = d
            closest = i
    return closest


def advance_along_geometry(geometry: list, current_index: int, distance_km: float):
    """Move forward along geometry by distance_km, return new index, lat, lng, heading."""
    idx = current_index
    remaining = distance_km
    while idx < len(geometry) - 1 and remaining > 0:
        seg_dist = _haversine_km(geometry[idx][0], geometry[idx][1], geometry[idx + 1][0], geometry[idx + 1][1])
        if seg_dist <= 0:
            idx += 1
            continue
        if remaining >= seg_dist:
            remaining -= seg_dist
            idx += 1
        else:
            frac = remaining / seg_dist
            lat = geometry[idx][0] + (geometry[idx + 1][0] - geometry[idx][0]) * frac
            lng = geometry[idx][1] + (geometry[idx + 1][1] - geometry[idx][1]) * frac
            heading = _bearing(geometry[idx][0], geometry[idx][1], geometry[idx + 1][0], geometry[idx + 1][1])
            return {"index": idx, "lat": lat, "lng": lng, "heading": heading}

    if idx >= len(geometry):
        idx = len(geometry) - 1
    return {
        "index": idx,
        "lat": geometry[idx][0],
        "lng": geometry[idx][1],
        "heading": 0,
    }


def compute_ghost_confidence(bus_state: BusState) -> float:
    elapsed = time.time() - bus_state.last_real_ping_time
    decay = (elapsed / 30) * 0.05
    return round(max(0.20, 0.90 - decay), 2)


def get_ping_interval(signal: int) -> float:
    if signal >= 70:
        return 2.0
    if signal >= 40:
        return 6.0
    if signal >= 10:
        return 12.0
    return 2.0  # ghost mode uses 2s


class BusEmitter:
    """Emitter for a single bus — runs as an asyncio task."""

    def __init__(self, bus_id: str, geometry: list, sim_config: SimConfig, buffer_mgr: BusBufferManager, broadcast_fn, log_fn):
        self.bus_id = bus_id
        self.state = BusState(bus_id, geometry)
        self.sim_config = sim_config
        self.buffer_mgr = buffer_mgr
        self.broadcast = broadcast_fn
        self.log_fn = log_fn
        self.route_stops = ROUTES[BUSES[bus_id]["route_id"]]["stops"]
        self.was_ghost = False

    async def run(self):
        while True:
            try:
                await self._tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[BusEmitter {self.bus_id}] Error: {e}")
                await asyncio.sleep(2)

    async def _tick(self):
        cfg = self.sim_config.get_bus_config(self.bus_id)
        st = self.state

        # ── Compute effective signal (dead zone override) ──
        active_zone = get_active_dead_zone(st.route_id, st.stop_index)
        st.prev_signal = st.signal_strength

        if active_zone:
            st.in_dead_zone = True
            st.dead_zone = active_zone
            lo, hi = active_zone["signal_range"]
            zone_signal = random.randint(lo, hi)
            st.signal_strength = zone_signal
        else:
            st.in_dead_zone = False
            st.dead_zone = None
            st.signal_strength = cfg.signal_strength + random.randint(-5, 5)
            st.signal_strength = max(0, min(100, st.signal_strength))

        # ── Traffic label ──
        st.traffic_level = TRAFFIC_LABELS.get(cfg.traffic_level, "medium")

        # ── Speed computation ──
        speed_base = cfg.bus_speed_override if cfg.bus_speed_override > 0 else st.base_speed
        traffic_factor = {0: 1.1, 1: 1.0, 2: 0.65}.get(cfg.traffic_level, 1.0)
        weather_factor = {0: 1.0, 1: 0.95, 2: 0.8}.get(cfg.weather, 1.0)
        st.speed_kmh = speed_base * traffic_factor * weather_factor + random.uniform(-2, 2)
        st.speed_kmh = max(5, st.speed_kmh)

        # ── Confidence score ──
        packet_loss_rate = cfg.packet_loss / 100.0
        is_buffering = st.signal_strength < 10
        confidence = compute_confidence_score(
            st.signal_strength, st.in_dead_zone, active_zone, packet_loss_rate, is_buffering
        )
        st.eta_confidence = confidence

        # ── GHOST MODE ──
        if st.signal_strength < 10:
            if not st.is_ghost:
                # Just entered ghost mode
                st.blackout_start_time = time.time()
                explanation = explainer.explain_ghost_activation(
                    self._state_dict(), active_zone
                )
                st.explanation = explanation
                self.log_fn("critical", explanation["decision"], explanation)
                if active_zone:
                    dz_explanation = explainer.explain_dead_zone_entry(self._state_dict(), active_zone)
                    self.log_fn("critical", dz_explanation["decision"], dz_explanation)

            st.is_ghost = True
            st.ping_type = "ghost"
            st.ghost_confidence = compute_ghost_confidence(st)

            # Extrapolate position along road geometry
            elapsed = time.time() - st.last_real_ping_time
            ghost_distance = (st.last_speed / 3600) * elapsed
            result = advance_along_geometry(st.route_geometry, st.geometry_index, ghost_distance * 0.3)
            st.lat = result["lat"]
            st.lng = result["lng"]
            st.heading_degrees = result["heading"]

            # Update stop index
            st.stop_index = _compute_stop_index(st.lat, st.lng, self.route_stops)
            st.route_progress = st.geometry_index / max(1, len(st.route_geometry) - 1)

            # Buffer the ghost ping
            ping = self._build_ping()
            self.buffer_mgr.store(self.bus_id, ping)
            st.buffer_size = self.buffer_mgr.size(self.bus_id)

            await self.broadcast(ping)
            self.was_ghost = True
            await asyncio.sleep(2)  # Ghost always 2s

        else:
            # ── SIGNAL RECOVERY — flush buffer ──
            if self.was_ghost:
                buffered = self.buffer_mgr.flush(self.bus_id)
                if buffered:
                    blackout_dur = time.time() - (st.blackout_start_time or time.time())
                    flush_exp = explainer.explain_buffer_flush(
                        self._state_dict(), len(buffered), blackout_dur
                    )
                    self.log_fn("info", flush_exp["decision"], flush_exp)
                    await self.broadcast({
                        "type": "buffer_flush",
                        "bus_id": self.bus_id,
                        "pings": buffered,
                        "explanation": flush_exp,
                    })
                st.is_ghost = False
                st.ping_type = "real"
                st.ghost_confidence = 1.0
                st.blackout_start_time = None
                self.was_ghost = False

            # ── Normal movement along geometry ──
            interval = get_ping_interval(st.signal_strength)
            distance_km = (st.speed_kmh / 3600) * interval
            result = advance_along_geometry(st.route_geometry, st.geometry_index, distance_km)

            st.geometry_index = result["index"]
            st.lat = result["lat"]
            st.lng = result["lng"]
            st.heading_degrees = result["heading"]
            st.last_real_ping_time = time.time()
            st.last_real_lat = st.lat
            st.last_real_lng = st.lng
            st.last_speed = st.speed_kmh
            st.last_heading = st.heading_degrees

            # Loop route if at end
            if st.geometry_index >= len(st.route_geometry) - 1:
                st.geometry_index = 0
                st.stop_index = 0

            st.stop_index = _compute_stop_index(st.lat, st.lng, self.route_stops)
            st.route_progress = st.geometry_index / max(1, len(st.route_geometry) - 1)
            st.buffer_size = self.buffer_mgr.size(self.bus_id)
            st.explanation = None

            if active_zone and not st.is_ghost:
                st.explanation = explainer.explain_dead_zone_entry(self._state_dict(), active_zone)

            ping = self._build_ping()
            await self.broadcast(ping)
            await asyncio.sleep(interval)

    def _state_dict(self) -> dict:
        st = self.state
        return {
            "bus_id": st.bus_id,
            "label": st.label,
            "route_id": st.route_id,
            "signal_strength": st.signal_strength,
            "prev_signal": st.prev_signal,
            "speed_kmh": st.speed_kmh,
            "heading_degrees": st.heading_degrees,
            "traffic_level": st.traffic_level,
            "eta_confidence": st.eta_confidence,
            "in_dead_zone": st.in_dead_zone,
        }

    def _build_ping(self) -> dict:
        st = self.state
        zone_payload = None
        if st.dead_zone:
            zone_payload = {
                "active": True,
                "zone_id": st.dead_zone["zone_id"],
                "name": st.dead_zone["name"],
                "severity": st.dead_zone["severity"],
                "reason": st.dead_zone["reason"],
                "confidence_score": st.dead_zone["confidence_score"],
                "historical_blackout_rate": st.dead_zone["historical_blackout_rate"],
            }

        return {
            "bus_id": st.bus_id,
            "label": st.label,
            "route_id": st.route_id,
            "route_name": st.route_name,
            "color": st.color,
            "lat": round(st.lat, 6),
            "lng": round(st.lng, 6),
            "speed_kmh": round(st.speed_kmh, 1),
            "heading_degrees": round(st.heading_degrees, 1),
            "signal_strength": st.signal_strength,
            "traffic_level": st.traffic_level,
            "ping_type": st.ping_type,
            "is_ghost": st.is_ghost,
            "ghost_confidence": round(st.ghost_confidence, 2) if st.is_ghost else None,
            "confidence_score": st.eta_confidence,
            "stop_index": st.stop_index,
            "next_stop": self.route_stops[min(st.stop_index + 1, len(self.route_stops) - 1)]["name"],
            "route_progress": round(st.route_progress, 4),
            "geometry_index": st.geometry_index,
            "buffer_size": st.buffer_size,
            "dead_zone": zone_payload,
            "explanation": st.explanation,
            "timestamp": time.strftime("%H:%M:%S"),
        }
