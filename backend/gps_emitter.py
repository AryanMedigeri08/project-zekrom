"""
Multi-Bus GPS Emitter — Phase 3.

Each bus runs independently along its road-following geometry,
with its own signal strength, traffic variation, and buffer.
"""

import random
import math
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional

from config import (
    BUS_DEFINITIONS,
    bus_configs,
    sim_config,
    haversine_km,
    bearing_degrees,
    get_traffic_label,
)


class BusEmitter:
    """
    Moves a single bus along a dense road-following geometry.

    The geometry is a list of (lat, lng) points from OSRM.
    The bus tracks its current index + sub-segment progress.
    """

    def __init__(
        self,
        bus_id: str,
        route_id: str,
        label: str,
        base_speed_kmh: float,
        geometry: List[Tuple[float, float]],
        stop_indices: List[int],
        stop_names: List[str],
    ):
        self.bus_id = bus_id
        self.route_id = route_id
        self.label = label
        self.base_speed_kmh = base_speed_kmh

        self.geometry = geometry
        self.stop_indices = stop_indices
        self.stop_names = stop_names

        # Movement state
        self._current_idx: int = 0
        self._segment_progress: float = 0.0
        self._direction: int = 1  # 1=forward, -1=reverse
        self._speed_kmh: float = base_speed_kmh
        self._stop_dwell_remaining: float = 0.0

        # Pre-compute segment distances
        self._segment_distances: List[float] = []
        for i in range(len(geometry) - 1):
            d = haversine_km(
                geometry[i][0], geometry[i][1],
                geometry[i + 1][0], geometry[i + 1][1],
            )
            self._segment_distances.append(max(d, 0.0001))

        # Signal drift state (per-bus gaussian drift)
        self._signal_drift: float = 0.0

    def update(self, dt_seconds: float) -> None:
        """Advance bus physics by dt_seconds."""
        if self._stop_dwell_remaining > 0:
            self._stop_dwell_remaining -= dt_seconds
            self._speed_kmh = 0.0
            return

        bus_cfg = bus_configs.get(self.bus_id)

        # Target speed: base + traffic penalty + noise
        traffic = bus_cfg.traffic_level if bus_cfg else 1
        traffic_factor = {0: 1.0, 1: 0.85, 2: 0.6}.get(traffic, 0.85)
        target = self.base_speed_kmh * traffic_factor + random.uniform(-2, 2)
        target = max(5.0, target)

        # Smooth acceleration
        self._speed_kmh += (target - self._speed_kmh) * 0.15
        self._speed_kmh = max(0, self._speed_kmh)

        # Distance covered this tick
        dist_km = (self._speed_kmh / 3600.0) * dt_seconds

        # Advance along geometry
        while dist_km > 0 and 0 <= self._current_idx < len(self._segment_distances):
            seg_len = self._segment_distances[self._current_idx]
            remaining_in_seg = seg_len * (1.0 - self._segment_progress)

            if dist_km >= remaining_in_seg:
                dist_km -= remaining_in_seg
                self._segment_progress = 0.0

                # Move to next segment
                next_idx = self._current_idx + self._direction
                if next_idx < 0 or next_idx >= len(self._segment_distances):
                    # Reverse at endpoints
                    self._direction *= -1
                    next_idx = self._current_idx + self._direction
                    if next_idx < 0 or next_idx >= len(self._segment_distances):
                        break
                    self._stop_dwell_remaining = random.uniform(5, 15)

                self._current_idx = next_idx

                # Check if we hit a stop
                if self._current_idx in self.stop_indices:
                    self._stop_dwell_remaining = random.uniform(8, 20)
                    break
            else:
                self._segment_progress += dist_km / seg_len
                dist_km = 0

    def get_position(self) -> Tuple[float, float]:
        """Current interpolated lat/lng."""
        if not self.geometry:
            return (0, 0)
        idx = min(self._current_idx, len(self.geometry) - 2)
        idx = max(0, idx)
        a = self.geometry[idx]
        b = self.geometry[min(idx + 1, len(self.geometry) - 1)]
        t = self._segment_progress
        return (
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
        )

    def get_heading(self) -> float:
        """Bearing in degrees."""
        if len(self.geometry) < 2:
            return 0
        idx = min(self._current_idx, len(self.geometry) - 2)
        idx = max(0, idx)
        a = self.geometry[idx]
        b = self.geometry[min(idx + 1, len(self.geometry) - 1)]
        return bearing_degrees(a[0], a[1], b[0], b[1])

    def get_current_stop_index(self) -> int:
        """Which stop (by index in stop_indices) the bus is nearest."""
        for i, si in enumerate(self.stop_indices):
            if self._current_idx <= si:
                return i
        return len(self.stop_indices) - 1

    def get_next_stop_name(self) -> str:
        idx = self.get_current_stop_index()
        if self._direction == 1:
            target = min(idx, len(self.stop_names) - 1)
        else:
            target = max(idx - 1, 0)
        return self.stop_names[target] if self.stop_names else "Unknown"

    def get_stops_remaining(self) -> int:
        current = self.get_current_stop_index()
        total = len(self.stop_indices)
        if self._direction == 1:
            return total - 1 - current
        return current

    def get_distance_covered_km(self) -> float:
        total = 0.0
        for i in range(min(self._current_idx, len(self._segment_distances))):
            total += self._segment_distances[i]
        if self._current_idx < len(self._segment_distances):
            total += self._segment_distances[self._current_idx] * self._segment_progress
        return total

    def get_route_progress(self) -> float:
        """0-1 progress along the geometry."""
        total_segs = len(self._segment_distances)
        if total_segs == 0:
            return 0
        return (self._current_idx + self._segment_progress) / total_segs

    def drift_signal(self) -> int:
        """Apply gaussian drift to per-bus signal. Returns effective signal."""
        bus_cfg = bus_configs.get(self.bus_id)
        if not bus_cfg:
            return 85
        base = bus_cfg.signal_strength
        self._signal_drift += random.gauss(0, 0.5)
        self._signal_drift = max(-10, min(10, self._signal_drift))
        effective = int(base + self._signal_drift)
        return max(0, min(100, effective))

    def create_ping(self, signal_strength: int, ping_type: str = "real") -> Dict[str, Any]:
        """Package current state into a JSON-serializable ping dict."""
        lat, lng = self.get_position()
        bus_cfg = bus_configs.get(self.bus_id)
        traffic = bus_cfg.traffic_level if bus_cfg else 1

        return {
            "bus_id": self.bus_id,
            "route_id": self.route_id,
            "label": self.label,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "speed_kmh": round(self._speed_kmh, 2),
            "heading_degrees": round(self.get_heading(), 2),
            "signal_strength": signal_strength,
            "traffic_level": get_traffic_label(traffic),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ping_type": ping_type,
            "stop_index": self.get_current_stop_index(),
            "next_stop": self.get_next_stop_name(),
            "route_progress": round(self.get_route_progress(), 4),
            "geometry_index": self._current_idx,
        }


def create_emitters(cached_routes: Dict[str, Any]) -> Dict[str, BusEmitter]:
    """
    Create one BusEmitter per bus, using the cached OSRM route geometry.
    """
    emitters = {}
    for bus_id, bus_def in BUS_DEFINITIONS.items():
        route_id = bus_def["route_id"]
        route_data = cached_routes.get(route_id)
        if not route_data:
            print(f"⚠ No route data for {bus_id} ({route_id}), skipping.")
            continue

        emitters[bus_id] = BusEmitter(
            bus_id=bus_id,
            route_id=route_id,
            label=bus_def["label"],
            base_speed_kmh=bus_def["base_speed_kmh"],
            geometry=route_data["geometry"],
            stop_indices=route_data["stop_indices"],
            stop_names=[s["name"] for s in route_data["stops"]],
        )

    return emitters
