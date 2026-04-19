"""
gps_emitter.py — Phase 9: Dual-mode emitter with distance-based movement.

Architecture:
  - Two independent emitter classes: LiveBusEmitter and LabBusEmitter
  - Both use distance_traveled_km (monotonically increasing, never decreasing)
  - LiveBusEmitter: autonomous signal, dead zones activate by geography
  - LabBusEmitter: slider-controlled via sim-config
  - Ghost mode advances ghost_distance_km forward (never snaps back)
  - Reconciliation accepts ghost position as real position
"""

import asyncio
import random
import time
import math
from typing import Optional, Set, Dict, Any, Callable

from config import BUSES, ROUTES, SimConfig, TRAFFIC_LABELS
from dead_zones import get_active_dead_zone, compute_confidence_score, get_dead_zones_for_route
from explainer import explainer
from buffer import BusBufferManager
from simulation_state import (
    BusSimState, build_distance_lookup, get_position_at_distance,
    compute_stop_index, haversine
)
from autonomous_signal import autonomous_signal_model


# ── Ping interval from signal ────────────────────────────────────

def get_ping_interval(signal: int) -> float:
    if signal >= 70:
        return 2.0
    if signal >= 40:
        return 6.0
    if signal >= 10:
        return 12.0
    return 2.0  # ghost mode uses 2s


def get_payload_size(signal: int) -> int:
    if signal >= 70:
        return 400
    if signal >= 40:
        return 180
    if signal >= 10:
        return 64
    return 38


def compute_bandwidth_saved(signal: int) -> float:
    full = 400
    current = get_payload_size(signal)
    return round((1 - current / full) * 100, 1)


def compute_ghost_confidence(state: BusSimState) -> float:
    if state.ghost_activation_time is None:
        return 0.90
    elapsed = time.time() - state.ghost_activation_time
    decay = (elapsed / 30) * 0.05
    return round(max(0.20, 0.90 - decay), 2)


def _find_next_dead_zone(route_id: str, current_stop_index: int, stops: list) -> dict | None:
    """Find the next dead zone ahead on the route, and its distance."""
    route_zones = get_dead_zones_for_route(route_id)
    if not route_zones:
        return None

    best = None
    best_distance = float("inf")

    for dz in route_zones:
        for si in dz["affected_stop_indices"]:
            if si > current_stop_index:
                if current_stop_index < len(stops) and si < len(stops):
                    dist = haversine(
                        stops[current_stop_index]["lat"], stops[current_stop_index]["lng"],
                        stops[si]["lat"], stops[si]["lng"]
                    )
                    if dist < best_distance:
                        best_distance = dist
                        best = {
                            "zone_id": dz["zone_id"],
                            "name": dz["name"],
                            "severity": dz["severity"],
                            "distance_km": round(dist, 2),
                            "stop_index": si,
                            "historical_blackout_rate": dz["historical_blackout_rate"],
                            "avg_duration_minutes": dz["avg_duration_minutes"],
                            "confidence_score": dz["confidence_score"],
                            "signal_range": dz["signal_range"],
                        }
    return best


# ══════════════════════════════════════════════════════════════════
#  SHARED TICK LOGIC — used by both Live and Lab emitters
# ══════════════════════════════════════════════════════════════════

class BusEmitterBase:
    """
    Base class shared between Live and Lab emitters.
    Handles distance-based movement, ghost mode, buffer, and ping building.
    """

    def __init__(self, bus_id: str, state: BusSimState, lookup: list,
                 buffer_mgr: BusBufferManager, broadcast_fn: Callable,
                 log_fn: Callable, route_stops: list):
        self.bus_id = bus_id
        self.state = state
        self.lookup = lookup
        self.total_km = lookup[-1][0] if lookup else 1.0
        self.buffer_mgr = buffer_mgr
        self.broadcast = broadcast_fn
        self.log_fn = log_fn
        self.route_stops = route_stops
        self.was_ghost = False

    async def run(self):
        while True:
            try:
                await self._tick()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[BusEmitter {self.bus_id}] Error: {e}")
                import traceback
                traceback.print_exc()
                await asyncio.sleep(2)

    async def _tick(self):
        raise NotImplementedError

    async def _advance_position(self, elapsed: float, speed_kmh: float, signal: int,
                                active_zone: dict | None, cfg_obj=None):
        """
        Core movement + ghost logic. Returns the ping dict to broadcast.
        This method handles:
          1. Distance advancement
          2. Ghost mode entry/exit
          3. Buffer management
          4. Ping building
        """
        st = self.state
        distance_this_tick = (speed_kmh / 3600) * elapsed

        if signal >= 10:
            # ── REAL PING MODE ──
            st.distance_traveled_km += distance_this_tick

            # Check trip completion
            if st.distance_traveled_km >= self.total_km:
                st.distance_traveled_km = st.distance_traveled_km % self.total_km
                st.trip_number += 1
                self.log_fn("info", f"Trip completed. Starting trip #{st.trip_number}.",
                            {"bus_id": self.bus_id, "decision": f"Trip #{st.trip_number} started"},
                            is_simulated=False)

            lat, lng, heading = get_position_at_distance(self.lookup, st.distance_traveled_km)
            st.lat = lat
            st.lng = lng
            st.heading_degrees = heading
            st.speed_kmh = speed_kmh
            st.last_real_lat = lat
            st.last_real_lng = lng
            st.last_real_speed_kmh = speed_kmh
            st.last_real_heading = heading
            st.last_real_ping_time = time.time()
            st.last_update_time = time.time()
            st.ping_type = "real"

            # Sync ghost to real
            st.ghost_distance_km = st.distance_traveled_km

            # ── Signal recovery — reconcile and flush ──
            if self.was_ghost:
                await self._reconcile_after_ghost(cfg_obj)
                self.was_ghost = False

            st.is_ghost = False
            st.ghost_confidence = 1.0
            st.ghost_start_time = None
            st.ghost_activation_time = None

            # Update stop/progress
            st.stop_index = compute_stop_index(lat, lng, self.route_stops)
            st.route_progress = st.distance_traveled_km / self.total_km

            # Phase 8: Layer telemetry
            st.buffer_size = self.buffer_mgr.size(self.bus_id)
            st.reconciliation_deviation_m = (
                st.reconciliation_deviation_m
                if st.ping_count_session % 5 != 0
                else None
            )
            st.eta_just_recalculated = False
            st.is_flushing = False

            # Dead zone explanation (if in zone but signal ok)
            if active_zone and not st.is_ghost:
                st.explanation = explainer.explain_dead_zone_entry(self._state_dict(), active_zone)
            else:
                st.explanation = None

            ping = self._build_ping(signal, active_zone, cfg_obj)
            return ping, get_ping_interval(signal)

        else:
            # ── GHOST MODE — signal < 10% ──
            if not st.is_ghost:
                # Just entered ghost mode
                st.is_ghost = True
                st.ghost_activation_time = time.time()
                st.blackout_start_time = time.time()
                st.blackout_start_distance = st.distance_traveled_km
                st.ghost_distance_km = st.distance_traveled_km
                st.ghost_start_time = time.time()
                st.ghost_confidence_history = [0.90]
                st.ghost_distance_display_km = 0.0
                st.reconciliation_deviation_m = None

                explanation = explainer.explain_ghost_activation(
                    self._state_dict(), active_zone
                )
                st.explanation = explanation
                is_sim = cfg_obj.is_overridden() if cfg_obj and hasattr(cfg_obj, 'is_overridden') else False
                self.log_fn("critical", explanation["decision"], explanation, is_simulated=is_sim)

                if active_zone:
                    dz_explanation = explainer.explain_dead_zone_entry(self._state_dict(), active_zone)
                    self.log_fn("critical", dz_explanation["decision"], dz_explanation, is_simulated=is_sim)

            st.ping_type = "ghost"
            st.ghost_confidence = compute_ghost_confidence(st)

            # Track confidence history
            st.ghost_confidence_history.append(st.ghost_confidence)
            if len(st.ghost_confidence_history) > 10:
                st.ghost_confidence_history.pop(0)

            # Advance GHOST position forward (not real position)
            st.ghost_distance_km += distance_this_tick
            st.ghost_distance_display_km = st.ghost_distance_km - st.blackout_start_distance
            st.speed_kmh = speed_kmh
            st.last_update_time = time.time()

            # Compute ghost position
            ghost_lat, ghost_lng, ghost_heading = get_position_at_distance(
                self.lookup, st.ghost_distance_km
            )
            st.lat = ghost_lat
            st.lng = ghost_lng
            st.heading_degrees = ghost_heading
            st.ghost_predicted_lat = ghost_lat
            st.ghost_predicted_lng = ghost_lng

            # Update stop index from ghost position
            st.stop_index = compute_stop_index(ghost_lat, ghost_lng, self.route_stops)
            st.route_progress = st.ghost_distance_km / self.total_km

            # Buffer the ghost ping
            ping = self._build_ping(signal, active_zone, cfg_obj)
            self.buffer_mgr.store(self.bus_id, ping)
            st.buffer_size = self.buffer_mgr.size(self.bus_id)

            # Track recent buffered pings
            st.recent_buffered_pings.append({
                "timestamp": ping["timestamp"],
                "lat": ping["lat"],
                "lng": ping["lng"],
            })
            if len(st.recent_buffered_pings) > 4:
                st.recent_buffered_pings.pop(0)

            self.was_ghost = True
            st.eta_just_recalculated = True

            return ping, 2.0  # Ghost always 2s

    async def _reconcile_after_ghost(self, cfg_obj=None):
        """
        Reconcile after ghost mode: accept ghost position as real.
        NEVER snap back to blackout start. Always continue forward.
        """
        st = self.state

        # Accept ghost position as real — bus continues from ghost's current position
        ghost_traveled = st.ghost_distance_km - st.blackout_start_distance
        st.distance_traveled_km = st.ghost_distance_km

        # Reconciliation deviation
        if st.ghost_predicted_lat is not None:
            deviation = haversine(
                st.ghost_predicted_lat, st.ghost_predicted_lng,
                st.lat, st.lng
            ) * 1000
            st.reconciliation_deviation_m = round(deviation, 1)

        # Flush buffer
        buffered = self.buffer_mgr.flush(self.bus_id)
        if buffered:
            blackout_dur = time.time() - (st.blackout_start_time or time.time())
            flush_exp = explainer.explain_buffer_flush(
                self._state_dict(), len(buffered), blackout_dur
            )
            is_sim = cfg_obj.is_overridden() if cfg_obj and hasattr(cfg_obj, 'is_overridden') else False
            self.log_fn("info", flush_exp["decision"], flush_exp, is_simulated=is_sim)

            st.is_flushing = True
            st.flush_progress = 0

            await self.broadcast({
                "type": "buffer_flush",
                "bus_id": self.bus_id,
                "pings": buffered,
                "explanation": flush_exp,
                "reconciliation": {
                    "blackout_start_km": round(st.blackout_start_distance, 3),
                    "ghost_end_km": round(st.ghost_distance_km, 3),
                    "distance_predicted_km": round(ghost_traveled, 3),
                    "action": "Accepted ghost position as real. No backward snap.",
                }
            })

            st.is_flushing = False
            st.flush_progress = 100

        st.blackout_start_time = None
        st.recent_buffered_pings = []
        self.log_fn("info",
                     f"Ghost reconciled for {st.label}. "
                     f"Position advanced to {st.distance_traveled_km:.2f}km. "
                     f"Ghost distance: {ghost_traveled:.2f}km. No backward snap.",
                     {"bus_id": self.bus_id, "decision": "Ghost reconciled"},
                     is_simulated=False)

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

    def _compute_dead_zone_telemetry(self, active_zone):
        """Update dead zone approach/progress telemetry (Phase 8 Layer 5)."""
        st = self.state

        if active_zone:
            st.in_dead_zone = True
            st.dead_zone = active_zone
            if st.dead_zone_start_time is None:
                st.dead_zone_start_time = time.time()
                st.pre_arming_complete = True

            elapsed_in_zone = time.time() - st.dead_zone_start_time
            expected_duration = active_zone.get("avg_duration_minutes", 4.0) * 60
            st.dead_zone_progress_pct = min(100, round((elapsed_in_zone / max(1, expected_duration)) * 100, 1))
        else:
            st.in_dead_zone = False
            st.dead_zone = None
            if st.dead_zone_start_time is not None:
                st.dead_zone_start_time = None
                st.dead_zone_progress_pct = 0.0

        # Next dead zone approach detection
        next_dz = _find_next_dead_zone(st.route_id, st.stop_index, self.route_stops)
        st.next_dead_zone_info = next_dz
        if next_dz and next_dz["distance_km"] < 2.0:
            st.approaching_dead_zone = True
            st.distance_to_dead_zone_km = next_dz["distance_km"]
            if next_dz["distance_km"] < 1.0:
                st.pre_arming_complete = True
        else:
            st.approaching_dead_zone = False
            st.distance_to_dead_zone_km = next_dz["distance_km"] if next_dz else None
            if not active_zone:
                st.pre_arming_complete = False

    def _compute_eta_telemetry(self):
        """Phase 8 Layer 4 telemetry."""
        st = self.state
        if st.is_ghost:
            st.eta_data_mode = "historical"
        elif st.signal_strength < 40:
            st.eta_data_mode = "hybrid"
        else:
            st.eta_data_mode = "live"

        if st.signal_strength >= 70:
            st.eta_cone_width = "narrow"
        elif st.signal_strength >= 40:
            st.eta_cone_width = "medium"
        else:
            st.eta_cone_width = "wide"

    def _build_ping(self, signal: int, active_zone: dict | None, cfg_obj=None) -> dict:
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

        ping_interval = get_ping_interval(signal)
        payload_size = get_payload_size(signal)
        bandwidth_saved = compute_bandwidth_saved(signal)

        latency_ms = cfg_obj.latency_ms if cfg_obj and hasattr(cfg_obj, 'latency_ms') else 100
        buffer_max = cfg_obj.buffer_size_limit if cfg_obj and hasattr(cfg_obj, 'buffer_size_limit') else 50

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
            "signal_strength": int(signal),
            "traffic_level": st.traffic_level,
            "ping_type": st.ping_type,
            "is_ghost": st.is_ghost,
            "ghost_confidence": round(st.ghost_confidence, 2) if st.is_ghost else None,
            "confidence_score": st.eta_confidence,
            "stop_index": st.stop_index,
            "next_stop": self.route_stops[min(st.stop_index + 1, len(self.route_stops) - 1)]["name"],
            "route_progress": round(st.route_progress, 4),
            "distance_km": round(st.distance_traveled_km, 3),
            "ghost_distance_km": round(st.ghost_distance_km, 3) if st.is_ghost else None,
            "buffer_size": st.buffer_size,
            "dead_zone": zone_payload,
            "explanation": st.explanation,
            "timestamp": time.strftime("%H:%M:%S"),
            "trip_number": st.trip_number,

            # Phase 8: Layer 1 — Adaptive Payload & Frequency
            "prev_signal": st.prev_signal,
            "payload_size_bytes": payload_size,
            "ping_interval_ms": int(ping_interval * 1000),
            "bandwidth_saved_pct": bandwidth_saved,
            "payload_history": list(st.payload_history),

            # Phase 8: Layer 2 — Store & Forward Buffer
            "buffer_count": st.buffer_size,
            "buffer_max": buffer_max,
            "is_flushing": st.is_flushing,
            "flush_progress": st.flush_progress,
            "recent_buffered_pings": list(st.recent_buffered_pings),

            # Phase 8: Layer 3 — Ghost Bus Extrapolation
            "ghost_confidence_history": list(st.ghost_confidence_history),
            "ghost_distance_traveled_km": round(st.ghost_distance_display_km, 3),
            "last_real_speed": round(st.last_real_speed_kmh, 1),
            "last_real_heading": round(st.last_real_heading, 1),
            "reconciliation_deviation_m": st.reconciliation_deviation_m,
            "ghost_start_time": st.ghost_start_time,

            # Phase 8: Layer 4 — ML ETA Prediction
            "eta_data_mode": st.eta_data_mode,
            "eta_cone_width": st.eta_cone_width,
            "eta_just_recalculated": st.eta_just_recalculated,

            # Phase 8: Layer 5 — Dead Zone Pre-awareness
            "approaching_dead_zone": st.approaching_dead_zone,
            "distance_to_dead_zone_km": st.distance_to_dead_zone_km,
            "next_dead_zone": st.next_dead_zone_info,
            "time_in_dead_zone_s": round(time.time() - st.dead_zone_start_time, 1) if st.dead_zone_start_time else 0,
            "dead_zone_progress_pct": st.dead_zone_progress_pct,
            "pre_arming_complete": st.pre_arming_complete,

            # Phase 8: Layer 6 — WebSocket Resilience
            "ws_latency_ms": latency_ms,
            "ws_reconnecting": False,
            "ws_reconnect_attempt": 0,
            "message_queue_depth": 0,
            "ws_uptime_s": round(time.time() - st.last_real_ping_time, 0) if st.is_ghost else 0,
            "missed_pings_session": st.missed_pings_session,
        }


# ══════════════════════════════════════════════════════════════════
#  LIVE BUS EMITTER — Autonomous (No slider control)
# ══════════════════════════════════════════════════════════════════

class LiveBusEmitter(BusEmitterBase):
    """
    Autonomous simulation for the Live Map.
    Signal varies based on route geography and dead zones — no slider input.
    """

    async def _tick(self):
        st = self.state
        now = time.time()
        elapsed = now - st.last_update_time

        # ── Autonomous signal computation ──
        st.prev_signal = st.signal_strength
        signal = autonomous_signal_model.get_signal(
            self.bus_id, st.distance_traveled_km, st.route_id, st.stop_index
        )
        st.signal_strength = int(signal)

        # ── Dead zone detection ──
        active_zone = get_active_dead_zone(st.route_id, st.stop_index)
        self._compute_dead_zone_telemetry(active_zone)

        # ── Traffic — autonomous variation ──
        st.traffic_level = random.choice(["low", "medium", "medium", "medium", "high"])

        # ── Speed computation ──
        traffic_factor = {"low": 1.0, "medium": 0.75, "high": 0.5}[st.traffic_level]
        variation = random.uniform(0.90, 1.10)
        speed_kmh = st.base_speed_kmh * traffic_factor * variation

        # Slow in dead zones
        if active_zone and active_zone["severity"] == "blackout":
            speed_kmh *= 0.7

        speed_kmh = max(5, speed_kmh)

        # ── Confidence ──
        packet_loss_rate = 0.05  # minimal for live
        is_buffering = st.signal_strength < 10
        st.eta_confidence = compute_confidence_score(
            st.signal_strength, st.in_dead_zone, active_zone, packet_loss_rate, is_buffering
        )

        # ── Layer telemetry ──
        self._compute_eta_telemetry()
        payload_size = get_payload_size(st.signal_strength)
        st.payload_history.append(payload_size)
        if len(st.payload_history) > 20:
            st.payload_history.pop(0)
        st.ping_count_session += 1

        # ── Movement + ghost logic ──
        ping, interval = await self._advance_position(
            elapsed, speed_kmh, st.signal_strength, active_zone, None
        )

        await self.broadcast(ping)
        await asyncio.sleep(interval)


# ══════════════════════════════════════════════════════════════════
#  LAB BUS EMITTER — Slider Controlled
# ══════════════════════════════════════════════════════════════════

class LabBusEmitter(BusEmitterBase):
    """
    Slider-controlled simulation for the Simulation Lab.
    Reads from sim_config for signal, traffic, weather, etc.
    """

    def __init__(self, bus_id: str, state: BusSimState, lookup: list,
                 sim_config: SimConfig, buffer_mgr: BusBufferManager,
                 broadcast_fn: Callable, log_fn: Callable, route_stops: list):
        super().__init__(bus_id, state, lookup, buffer_mgr, broadcast_fn, log_fn, route_stops)
        self.sim_config = sim_config

    async def _tick(self):
        st = self.state
        now = time.time()
        elapsed = now - st.last_update_time
        cfg = self.sim_config.get_bus_config(self.bus_id)

        # ── Signal from config (slider/scenario controlled) ──
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

        self._compute_dead_zone_telemetry(active_zone)

        # ── Traffic ──
        st.traffic_level = TRAFFIC_LABELS.get(cfg.traffic_level, "medium")

        # ── Speed ──
        speed_base = cfg.bus_speed_override if cfg.bus_speed_override > 0 else st.base_speed_kmh
        traffic_factor = {0: 1.1, 1: 1.0, 2: 0.65}.get(cfg.traffic_level, 1.0)
        weather_factor = {0: 1.0, 1: 0.95, 2: 0.8}.get(cfg.weather, 1.0)
        speed_kmh = speed_base * traffic_factor * weather_factor + random.uniform(-2, 2)
        speed_kmh = max(5, speed_kmh)

        # ── Confidence ──
        packet_loss_rate = cfg.packet_loss / 100.0
        is_buffering = st.signal_strength < 10
        st.eta_confidence = compute_confidence_score(
            st.signal_strength, st.in_dead_zone, active_zone, packet_loss_rate, is_buffering
        )

        # ── Layer telemetry ──
        self._compute_eta_telemetry()
        payload_size = get_payload_size(st.signal_strength)
        st.payload_history.append(payload_size)
        if len(st.payload_history) > 20:
            st.payload_history.pop(0)
        st.ping_count_session += 1

        # ── Movement + ghost logic ──
        ping, interval = await self._advance_position(
            elapsed, speed_kmh, st.signal_strength, active_zone, cfg
        )

        await self.broadcast(ping)
        await asyncio.sleep(interval)
