"""
Configuration for the Resilient Public Transport Tracking System.

Defines the college bus route from Nigdi to MIT Academy of Engineering (Alandi Road, Pune)
with realistic waypoints, speed limits, and signal strength simulation tiers.
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional


# ---------------------------------------------------------------------------
# Waypoint Model
# ---------------------------------------------------------------------------

@dataclass
class Waypoint:
    """A single point on the bus route."""
    lat: float
    lng: float
    name: str
    is_stop: bool = False
    # Target speed (km/h) the bus should approach as it nears this waypoint.
    # Lower values at stops simulate deceleration for passenger boarding.
    speed_limit_kmh: float = 40.0


# ---------------------------------------------------------------------------
# Route Definition — MIT Academy of Engineering, Pune (Alandi Road)
# ---------------------------------------------------------------------------
# The route goes from Nigdi (west Pune) eastward through Chinchwad, Pimpri,
# Bhosari, Moshi, and finally up Alandi Road to MIT AOE campus.
# Intermediate (non-stop) waypoints ensure the polyline follows real roads
# more closely and gives smoother simulated movement.
# ---------------------------------------------------------------------------

ROUTE_WAYPOINTS: List[Waypoint] = [
    # ---- Stop 1: Nigdi ----
    Waypoint(18.6519, 73.7624, "Nigdi Bus Stop", is_stop=True, speed_limit_kmh=15.0),
    Waypoint(18.6515, 73.7720, "Nigdi–Akurdi Road", speed_limit_kmh=35.0),

    # ---- Stop 2: Akurdi ----
    Waypoint(18.6507, 73.7867, "Akurdi Chowk", is_stop=True, speed_limit_kmh=15.0),
    Waypoint(18.6450, 73.7890, "Akurdi–Chinchwad Link", speed_limit_kmh=40.0),

    # ---- Stop 3: Chinchwad Station ----
    Waypoint(18.6346, 73.7914, "Chinchwad Station", is_stop=True, speed_limit_kmh=12.0),
    Waypoint(18.6310, 73.7970, "Chinchwad–Pimpri Road", speed_limit_kmh=35.0),

    # ---- Stop 4: Pimpri Chowk ----
    Waypoint(18.6298, 73.8050, "Pimpri Chowk", is_stop=True, speed_limit_kmh=12.0),
    Waypoint(18.6310, 73.8130, "Pimpri–Kasarwadi Road", speed_limit_kmh=42.0),

    # ---- Stop 5: Kasarwadi ----
    Waypoint(18.6340, 73.8213, "Kasarwadi", is_stop=True, speed_limit_kmh=18.0),
    Waypoint(18.6370, 73.8310, "Kasarwadi–Bhosari Link", speed_limit_kmh=45.0),

    # ---- Stop 6: Bhosari ----
    Waypoint(18.6410, 73.8420, "Bhosari", is_stop=True, speed_limit_kmh=18.0),
    Waypoint(18.6480, 73.8460, "Bhosari–Moshi Road", speed_limit_kmh=50.0),
    Waypoint(18.6580, 73.8500, "Moshi Approach", speed_limit_kmh=45.0),

    # ---- Stop 7: Moshi ----
    Waypoint(18.6650, 73.8530, "Moshi", is_stop=True, speed_limit_kmh=12.0),
    Waypoint(18.6690, 73.8620, "Moshi–Alandi Road", speed_limit_kmh=50.0),
    Waypoint(18.6730, 73.8750, "Alandi Approach", speed_limit_kmh=40.0),

    # ---- Stop 8: Alandi Devachi ----
    Waypoint(18.6770, 73.8880, "Alandi Devachi", is_stop=True, speed_limit_kmh=12.0),
    Waypoint(18.6760, 73.8920, "MIT Approach Road", speed_limit_kmh=25.0),

    # ---- Stop 9: MIT AOE (Destination) ----
    Waypoint(18.6725, 73.8946, "MIT Academy of Engineering", is_stop=True, speed_limit_kmh=10.0),
]


# ---------------------------------------------------------------------------
# Signal Strength Tiers
# ---------------------------------------------------------------------------
# Maps signal quality bands to ping emission intervals (seconds).
# Below 10 % the emitter enters "dead zone" — pings are buffered, not sent.
# ---------------------------------------------------------------------------

SIGNAL_TIERS = {
    "excellent": {"min": 70, "max": 100, "interval_s": 2},
    "good":      {"min": 40, "max": 70,  "interval_s": 6},
    "poor":      {"min": 10, "max": 40,  "interval_s": 12},
    "dead":      {"min": 0,  "max": 10,  "interval_s": None},   # buffer mode
}


def get_ping_interval(signal_strength: int) -> Optional[float]:
    """
    Return the ping interval (seconds) for a given signal strength (0–100).
    Returns None when signal is in the dead zone (< 10 %), meaning pings
    should be buffered rather than emitted.
    """
    if signal_strength >= 70:
        return 2.0
    elif signal_strength >= 40:
        return 6.0
    elif signal_strength >= 10:
        return 12.0
    else:
        return None  # dead zone — buffer mode


# ---------------------------------------------------------------------------
# Geo-math Helpers
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth (km).
    Uses the Haversine formula.
    """
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the initial bearing (heading) from point 1 to point 2 in degrees (0–360).
    0° = North, 90° = East, etc.
    """
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlam = math.radians(lon2 - lon1)

    x = math.sin(dlam) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam)

    return (math.degrees(math.atan2(x, y)) + 360) % 360


# ---------------------------------------------------------------------------
# Simulation Defaults
# ---------------------------------------------------------------------------

SIMULATION_TICK_S: float = 0.5       # Physics update every 500 ms
HEARTBEAT_INTERVAL_S: float = 1.0    # Signal heartbeat to frontend every 1 s
DEFAULT_SIGNAL_STRENGTH: int = 85    # Starting signal strength


# ---------------------------------------------------------------------------
# SimConfig — Mutable simulation parameters (Phase 2)
# ---------------------------------------------------------------------------
# The What-If Simulation Dashboard adjusts these in real time via
# POST /api/sim-config.  The GPS emitter reads from the global
# `sim_config` instance on every tick.
# ---------------------------------------------------------------------------

@dataclass
class SimConfig:
    """All parameters the What-If dashboard can tweak live."""

    # ── Network Layer ──
    signal_strength: int = DEFAULT_SIGNAL_STRENGTH   # 0–100 %
    packet_loss: int = 5                             # 0–50 %
    latency_ms: int = 100                            # 0–2000 ms

    # ── Environment Layer ──
    bus_speed_override: float = 0.0   # 0 = use emitter's own speed; >0 overrides
    traffic_level: int = 1            # 0=low, 1=medium, 2=high
    weather: int = 0                  # 0=clear, 1=cloudy, 2=rain

    # ── System Behavior Layer ──
    buffer_size_limit: int = 50       # max pings to store offline
    interpolation_mode: str = "smooth"  # "smooth" | "literal"

    def to_dict(self) -> dict:
        return {
            "signal_strength": self.signal_strength,
            "packet_loss": self.packet_loss,
            "latency_ms": self.latency_ms,
            "bus_speed_override": self.bus_speed_override,
            "traffic_level": self.traffic_level,
            "weather": self.weather,
            "buffer_size_limit": self.buffer_size_limit,
            "interpolation_mode": self.interpolation_mode,
        }

    def derive_ping_interval(self) -> Optional[float]:
        """Compute effective ping interval factoring in signal + packet loss."""
        base = get_ping_interval(self.signal_strength)
        if base is None:
            return None
        # Packet loss increases effective interval (some pings are "dropped")
        loss_factor = 1.0 + (self.packet_loss / 100.0) * 0.5
        return base * loss_factor

    def derive_payload_size(self) -> int:
        """Estimated payload size in bytes based on signal quality."""
        if self.signal_strength >= 70:
            return 256   # full payload
        elif self.signal_strength >= 40:
            return 128   # compressed
        else:
            return 64    # minimal

    def derive_buffer_risk(self) -> str:
        """Assess data-loss risk from current buffer + signal state."""
        if self.signal_strength < 10:
            return "high"
        elif self.signal_strength < 40 or self.packet_loss > 25:
            return "medium"
        return "low"

    def derived_values(self) -> dict:
        """All computed values the frontend cards need."""
        interval = self.derive_ping_interval()
        return {
            "ping_interval_ms": int(interval * 1000) if interval else None,
            "pings_per_minute": round(60 / interval, 1) if interval else 0,
            "payload_size_bytes": self.derive_payload_size(),
            "payload_mode": "full" if self.signal_strength >= 70 else (
                "compressed" if self.signal_strength >= 40 else "minimal"
            ),
            "buffer_risk": self.derive_buffer_risk(),
            "buffer_mode": "active" if self.signal_strength < 10 else "standby",
            "confidence_width": (
                "narrow" if self.signal_strength >= 70 else
                "medium" if self.signal_strength >= 40 else "wide"
            ),
        }


# Global mutable instance — shared across the backend
sim_config = SimConfig()


# ---------------------------------------------------------------------------
# Route Total Distance (pre-computed for trip-status endpoint)
# ---------------------------------------------------------------------------

def compute_total_route_km() -> float:
    """Sum of all segment distances along the route."""
    total = 0.0
    for i in range(len(ROUTE_WAYPOINTS) - 1):
        a, b = ROUTE_WAYPOINTS[i], ROUTE_WAYPOINTS[i + 1]
        total += haversine_km(a.lat, a.lng, b.lat, b.lng)
    return total

TOTAL_ROUTE_KM: float = compute_total_route_km()
