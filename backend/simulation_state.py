"""
simulation_state.py — Phase 9: Distance-based bus simulation state.

Core architecture:
  - Each bus tracks `distance_traveled_km` — a float that ONLY increases.
  - Route geometry is pre-computed as a cumulative distance lookup table.
  - Position at any distance is found via binary search + linear interpolation.
  - No more index bouncing. Buses travel one-way and loop at route end.
"""

import math
import time
from typing import List, Tuple, Optional


# ── Haversine ────────────────────────────────────────────────────

def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Returns distance in km between two coordinates."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


# ── Bearing ──────────────────────────────────────────────────────

def bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Returns bearing in degrees (0-360) from point 1 to point 2."""
    dlng = math.radians(lng2 - lng1)
    lat1r = math.radians(lat1)
    lat2r = math.radians(lat2)
    x = math.sin(dlng) * math.cos(lat2r)
    y = (math.cos(lat1r) * math.sin(lat2r) -
         math.sin(lat1r) * math.cos(lat2r) * math.cos(dlng))
    return (math.degrees(math.atan2(x, y)) + 360) % 360


# ── Distance Lookup Table ────────────────────────────────────────

def build_distance_lookup(geometry_points: List[List[float]]) -> List[Tuple[float, float, float]]:
    """
    Pre-compute route geometry as a cumulative distance array.

    geometry_points: list of [lat, lng] pairs
    Returns: list of (cumulative_distance_km, lat, lng)
    """
    if not geometry_points:
        return [(0.0, 0.0, 0.0)]

    lookup = [(0.0, geometry_points[0][0], geometry_points[0][1])]

    for i in range(1, len(geometry_points)):
        prev_lat, prev_lng = geometry_points[i - 1][0], geometry_points[i - 1][1]
        curr_lat, curr_lng = geometry_points[i][0], geometry_points[i][1]

        segment_km = haversine(prev_lat, prev_lng, curr_lat, curr_lng)
        cumulative = lookup[-1][0] + segment_km
        lookup.append((cumulative, curr_lat, curr_lng))

    return lookup


def get_position_at_distance(
    lookup: List[Tuple[float, float, float]],
    distance_km: float
) -> Tuple[float, float, float]:
    """
    Given a distance along the route, returns the exact (lat, lng, heading)
    at that point using linear interpolation between geometry points.

    The distance wraps for looping trips.
    """
    if not lookup or len(lookup) < 2:
        if lookup:
            return lookup[0][1], lookup[0][2], 0.0
        return 0.0, 0.0, 0.0

    total_km = lookup[-1][0]
    if total_km <= 0:
        return lookup[0][1], lookup[0][2], 0.0

    # Wrap distance for looping trips
    distance_km = distance_km % total_km

    # Linear search for the segment (geometry usually ~200-2000 points)
    for i in range(1, len(lookup)):
        if lookup[i][0] >= distance_km:
            seg_start_d = lookup[i - 1][0]
            seg_end_d = lookup[i][0]
            seg_len = seg_end_d - seg_start_d

            if seg_len <= 0:
                return lookup[i][1], lookup[i][2], 0.0

            t = (distance_km - seg_start_d) / seg_len

            lat = lookup[i - 1][1] + t * (lookup[i][1] - lookup[i - 1][1])
            lng = lookup[i - 1][2] + t * (lookup[i][2] - lookup[i - 1][2])

            # Heading from segment direction
            heading_deg = bearing(
                lookup[i - 1][1], lookup[i - 1][2],
                lookup[i][1], lookup[i][2]
            )

            return lat, lng, heading_deg

    # At end of route — return last point
    return lookup[-1][1], lookup[-1][2], 0.0


def compute_stop_index(lat: float, lng: float, stops: list) -> int:
    """Find the closest stop index to the current position."""
    min_dist = float("inf")
    closest = 0
    for i, s in enumerate(stops):
        d = haversine(lat, lng, s["lat"], s["lng"])
        if d < min_dist:
            min_dist = d
            closest = i
    return closest


# ── BusSimState ──────────────────────────────────────────────────

class BusSimState:
    """
    Mutable per-bus simulation state.

    Core invariant: distance_traveled_km ONLY increases.
    When a trip completes (distance >= total_km), it wraps via modulo
    and trip_number increments.
    """

    def __init__(self, bus_id: str, route_id: str, label: str, route_name: str,
                 color: str, base_speed_kmh: float):
        self.bus_id = bus_id
        self.route_id = route_id
        self.label = label
        self.route_name = route_name
        self.color = color
        self.base_speed_kmh = base_speed_kmh

        # ── Distance-based position ──
        self.distance_traveled_km = 0.0  # ONLY increases (wraps at trip end)
        self.trip_number = 1
        self.last_update_time = time.time()

        # ── Current computed position ──
        self.lat = 0.0
        self.lng = 0.0
        self.heading_degrees = 0.0
        self.speed_kmh = base_speed_kmh

        # ── Signal / traffic ──
        self.signal_strength = 85
        self.prev_signal = 85
        self.traffic_level = "medium"

        # ── Ghost mode ──
        self.is_ghost = False
        self.ghost_confidence = 1.0
        self.ping_type = "real"
        self.ghost_distance_km = 0.0  # ghost's projected distance
        self.ghost_activation_time = None
        self.blackout_start_distance = 0.0

        # ── Real position tracking (for reconciliation) ──
        self.last_real_lat = 0.0
        self.last_real_lng = 0.0
        self.last_real_speed_kmh = base_speed_kmh
        self.last_real_heading = 0.0
        self.last_real_ping_time = time.time()

        # ── Buffer ──
        self.buffer: list = []
        self.buffer_size = 0

        # ── Stop / progress ──
        self.stop_index = 0
        self.route_progress = 0.0

        # ── Dead zone state ──
        self.dead_zone = None
        self.in_dead_zone = False
        self.dead_zone_start_time = None
        self.dead_zone_progress_pct = 0.0

        # ── Explainability ──
        self.explanation = None
        self.eta_confidence = 0.8

        # ── Phase 8 Layer telemetry ──
        self.ghost_confidence_history = []
        self.ghost_start_time = None
        self.ghost_distance_display_km = 0.0
        self.reconciliation_deviation_m = None
        self.ghost_predicted_lat = None
        self.ghost_predicted_lng = None

        self.approaching_dead_zone = False
        self.next_dead_zone_info = None
        self.distance_to_dead_zone_km = None
        self.pre_arming_complete = False

        self.prev_eta_minutes = None
        self.last_eta_raw = None
        self.last_eta_inputs = None
        self.eta_delta = 0.0
        self.eta_data_mode = "live"
        self.eta_cone_width = "narrow"
        self.eta_just_recalculated = False

        self.ping_count_session = 0
        self.missed_pings_session = 0
        self.is_flushing = False
        self.flush_progress = 0
        self.recent_buffered_pings = []

        self.payload_history = []

        # ── Blackout start time (for timing) ──
        self.blackout_start_time = None
