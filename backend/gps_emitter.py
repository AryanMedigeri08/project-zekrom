"""
Synthetic GPS Emitter — Bus Movement Simulation Engine.

Simulates a college bus moving along the predefined route with:
  • Realistic speed variation (slower near stops, faster on open road)
  • Smooth acceleration / deceleration between waypoints
  • Heading (bearing) calculation for ghost-bus extrapolation
  • Route looping (forward → reverse → forward …)
"""

import math
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

from config import Waypoint, ROUTE_WAYPOINTS, haversine_km, bearing_degrees, sim_config


@dataclass
class BusState:
    """Snapshot of the bus at a moment in time."""
    lat: float = 0.0
    lng: float = 0.0
    heading: float = 0.0          # degrees, 0 = North
    speed_kmh: float = 0.0
    current_stop: str = ""
    next_stop: str = ""
    route_progress: float = 0.0   # 0.0–1.0 across entire route


class GPSEmitter:
    """
    Stateful engine that advances a virtual bus along ROUTE_WAYPOINTS.

    Call `update(dt)` every simulation tick.  The emitter tracks which
    segment (pair of consecutive waypoints) the bus is on and interpolates
    the position using elapsed time and current speed.

    When the bus reaches the final waypoint it reverses direction,
    simulating a round-trip service.
    """

    def __init__(self, waypoints: Optional[List[Waypoint]] = None) -> None:
        self.waypoints: List[Waypoint] = waypoints or ROUTE_WAYPOINTS
        self._segment_idx: int = 0          # index of segment START waypoint
        self._segment_progress: float = 0.0 # 0.0 → 1.0 within current segment
        self._speed_kmh: float = 25.0       # current actual speed
        self._direction: int = 1            # +1 = forward, -1 = reverse
        self._stop_dwell_remaining: float = 0.0  # seconds to wait at a stop

        # Pre-compute segment distances so we don't recalculate each tick
        self._segment_distances: List[float] = []
        for i in range(len(self.waypoints) - 1):
            a, b = self.waypoints[i], self.waypoints[i + 1]
            self._segment_distances.append(haversine_km(a.lat, a.lng, b.lat, b.lng))

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def update(self, dt_seconds: float) -> None:
        """
        Advance the bus simulation by `dt_seconds`.
        Handles speed changes, segment transitions, stop dwelling, and
        direction reversal at route endpoints.
        """
        # If the bus is dwelling at a stop, count down before moving on
        if self._stop_dwell_remaining > 0:
            self._stop_dwell_remaining -= dt_seconds
            self._speed_kmh = 0.0
            return

        # ---- Target speed ----
        # If the SimConfig has a speed override (> 0), use it directly.
        # Otherwise fall back to the waypoint speed-limit logic.
        if sim_config.bus_speed_override > 0:
            target_speed = sim_config.bus_speed_override + random.uniform(-2, 2)
        else:
            target_wp = self._target_waypoint()
            target_speed = target_wp.speed_limit_kmh + random.uniform(-3, 3)
        target_speed = max(5.0, target_speed)  # never negative / unreasonably slow

        # Smooth acceleration / deceleration toward target speed
        accel_factor = 0.15  # how aggressively speed converges per tick
        self._speed_kmh += (target_speed - self._speed_kmh) * accel_factor

        # ---- Distance covered this tick ----
        dist_km = (self._speed_kmh / 3600.0) * dt_seconds

        # ---- Advance along the current segment ----
        seg_dist = self._current_segment_distance()
        if seg_dist > 0:
            self._segment_progress += dist_km / seg_dist
        else:
            self._segment_progress = 1.0

        # ---- Handle segment boundary crossings ----
        while self._segment_progress >= 1.0:
            overshoot = self._segment_progress - 1.0
            self._advance_segment()

            # Check if we hit a stop — dwell for a realistic duration
            current_wp = self.waypoints[self._segment_idx]
            if current_wp.is_stop:
                self._stop_dwell_remaining = random.uniform(3.0, 8.0)
                self._segment_progress = 0.0
                self._speed_kmh = 0.0
                return

            # Carry over the overshoot into the next segment
            next_dist = self._current_segment_distance()
            if next_dist > 0:
                self._segment_progress = (overshoot * seg_dist) / next_dist
            else:
                self._segment_progress = 0.0
            seg_dist = next_dist

    def get_position(self) -> Tuple[float, float]:
        """Return the current (lat, lng) of the bus."""
        a = self.waypoints[self._segment_idx]
        b = self._target_waypoint()
        t = self._segment_progress

        lat = a.lat + (b.lat - a.lat) * t
        lng = a.lng + (b.lng - a.lng) * t
        return (lat, lng)

    def get_heading(self) -> float:
        """Return the current heading in degrees (0–360), accounting for direction."""
        a = self.waypoints[self._segment_idx]
        b = self._target_waypoint()
        heading = bearing_degrees(a.lat, a.lng, b.lat, b.lng)
        # When reversing, the heading stays correct because _target_waypoint
        # already accounts for direction via _effective_index.
        return heading

    def get_state(self) -> BusState:
        """Return a full state snapshot of the bus."""
        lat, lng = self.get_position()
        heading = self.get_heading()

        # Identify the nearest stop the bus just left and the next one
        current_stop_name = self.waypoints[self._segment_idx].name
        target_wp = self._target_waypoint()
        next_stop_name = target_wp.name

        # Overall route progress (0–1)
        total_segs = len(self.waypoints) - 1
        route_progress = (self._segment_idx + self._segment_progress) / total_segs
        if self._direction == -1:
            route_progress = 1.0 - route_progress

        return BusState(
            lat=lat,
            lng=lng,
            heading=heading,
            speed_kmh=self._speed_kmh,
            current_stop=current_stop_name,
            next_stop=next_stop_name,
            route_progress=route_progress,
        )

    def get_current_stop_index(self) -> int:
        """Return the index of the current stop (among stop-only waypoints)."""
        stops = [i for i, wp in enumerate(self.waypoints) if wp.is_stop]
        for rank, wp_idx in enumerate(stops):
            if self._segment_idx <= wp_idx:
                return rank
        return len(stops) - 1

    def get_stops_remaining(self) -> int:
        """How many stops are left until the route endpoint."""
        stops = [i for i, wp in enumerate(self.waypoints) if wp.is_stop]
        current_rank = self.get_current_stop_index()
        if self._direction == 1:
            return len(stops) - 1 - current_rank
        else:
            return current_rank

    def get_distance_covered_km(self) -> float:
        """Approximate km covered from the start of the route."""
        total = 0.0
        for i in range(self._segment_idx):
            if i < len(self._segment_distances):
                total += self._segment_distances[i]
        # Add partial current segment
        if self._segment_idx < len(self._segment_distances):
            total += self._segment_distances[self._segment_idx] * self._segment_progress
        return total

    def create_ping(self, signal_strength: int) -> Dict[str, Any]:
        """
        Package the current state into a JSON-serialisable ping dict.
        Includes a UTC timestamp for buffer reconstruction.
        """
        state = self.get_state()
        return {
            "lat": round(state.lat, 6),
            "lng": round(state.lng, 6),
            "heading": round(state.heading, 2),
            "speed_kmh": round(state.speed_kmh, 2),
            "current_stop": state.current_stop,
            "next_stop": state.next_stop,
            "route_progress": round(state.route_progress, 4),
            "signal_strength": signal_strength,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _target_waypoint(self) -> Waypoint:
        """The waypoint the bus is currently heading toward."""
        target_idx = self._segment_idx + self._direction
        # Clamp to valid range
        target_idx = max(0, min(target_idx, len(self.waypoints) - 1))
        return self.waypoints[target_idx]

    def _current_segment_distance(self) -> float:
        """Distance (km) of the segment the bus is currently traversing."""
        idx = self._segment_idx
        if self._direction == 1:
            if idx < len(self._segment_distances):
                return self._segment_distances[idx]
        else:
            # Reverse: segment runs from idx back to idx-1
            if idx - 1 >= 0 and idx - 1 < len(self._segment_distances):
                return self._segment_distances[idx - 1]
        return 0.0

    def _advance_segment(self) -> None:
        """
        Move to the next segment.  If we've reached an endpoint, reverse
        direction to simulate a round-trip bus service.
        """
        next_idx = self._segment_idx + self._direction

        if next_idx >= len(self.waypoints) - 1:
            # Reached the last waypoint — reverse
            self._segment_idx = len(self.waypoints) - 1
            self._direction = -1
            self._segment_progress = 0.0
        elif next_idx <= 0:
            # Reached the first waypoint — go forward again
            self._segment_idx = 0
            self._direction = 1
            self._segment_progress = 0.0
        else:
            self._segment_idx = next_idx
            self._segment_progress = 0.0
