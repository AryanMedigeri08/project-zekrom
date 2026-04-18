"""
Configuration — Phase 3: Multi-bus, multi-route system.

Defines 3 routes around Pune, 3 buses, per-bus config,
signal tiers, and geo-math helpers.
"""

import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


# ---------------------------------------------------------------------------
# Route Definitions (stop coordinates for OSRM)
# ---------------------------------------------------------------------------

ROUTE_DEFINITIONS: Dict[str, Any] = {
    "route_purple": {
        "name": "MIT AOE Campus Loop",
        "color_id": "purple",
        "stops": [
            {"lat": 18.6678, "lng": 74.1235, "name": "MIT AOE Main Gate", "is_stop": True},
            {"lat": 18.6751, "lng": 74.1298, "name": "Alandi Village", "is_stop": True},
            {"lat": 18.5665, "lng": 73.9319, "name": "Wadgaon Sheri", "is_stop": True},
            {"lat": 18.5679, "lng": 73.9143, "name": "Viman Nagar", "is_stop": True},
            {"lat": 18.5489, "lng": 73.9054, "name": "Kalyani Nagar", "is_stop": True},
            {"lat": 18.5362, "lng": 73.8938, "name": "Koregaon Park", "is_stop": True},
            {"lat": 18.5195, "lng": 73.8553, "name": "Pune Railway Station", "is_stop": True},
            {"lat": 18.5018, "lng": 73.8571, "name": "Swargate", "is_stop": True},
        ],
    },
    "route_teal": {
        "name": "Hinjewadi Tech Corridor",
        "color_id": "teal",
        "stops": [
            {"lat": 18.5912, "lng": 73.7389, "name": "Hinjewadi Phase 1", "is_stop": True},
            {"lat": 18.5998, "lng": 73.7201, "name": "Hinjewadi Phase 3", "is_stop": True},
            {"lat": 18.6007, "lng": 73.7619, "name": "Wakad", "is_stop": True},
            {"lat": 18.6138, "lng": 73.7891, "name": "Pimple Saudagar", "is_stop": True},
            {"lat": 18.5582, "lng": 73.8074, "name": "Aundh", "is_stop": True},
            {"lat": 18.5590, "lng": 73.7868, "name": "Baner", "is_stop": True},
            {"lat": 18.5274, "lng": 73.7940, "name": "Pashan", "is_stop": True},
            {"lat": 18.5074, "lng": 73.8074, "name": "Kothrud", "is_stop": True},
        ],
    },
    "route_orange": {
        "name": "Hadapsar-Katraj Ring",
        "color_id": "orange",
        "stops": [
            {"lat": 18.5018, "lng": 73.9259, "name": "Hadapsar", "is_stop": True},
            {"lat": 18.5117, "lng": 73.9291, "name": "Magarpatta", "is_stop": True},
            {"lat": 18.4797, "lng": 73.9006, "name": "NIBM Road", "is_stop": True},
            {"lat": 18.4648, "lng": 73.8891, "name": "Kondhwa", "is_stop": True},
            {"lat": 18.4530, "lng": 73.8626, "name": "Katraj", "is_stop": True},
            {"lat": 18.4680, "lng": 73.8535, "name": "Dhankawadi", "is_stop": True},
            {"lat": 18.4869, "lng": 73.8554, "name": "Sahakarnagar", "is_stop": True},
            {"lat": 18.4940, "lng": 73.8601, "name": "Bibwewadi", "is_stop": True},
        ],
    },
}


# ---------------------------------------------------------------------------
# Bus Definitions
# ---------------------------------------------------------------------------

BUS_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "bus_01": {
        "id": "bus_01",
        "route_id": "route_purple",
        "label": "MIT-01",
        "base_speed_kmh": 35,
    },
    "bus_02": {
        "id": "bus_02",
        "route_id": "route_teal",
        "label": "HIN-02",
        "base_speed_kmh": 30,
    },
    "bus_03": {
        "id": "bus_03",
        "route_id": "route_orange",
        "label": "HAD-03",
        "base_speed_kmh": 38,
    },
}


# ---------------------------------------------------------------------------
# Per-Bus Mutable Config
# ---------------------------------------------------------------------------

@dataclass
class BusConfig:
    """Mutable config per bus — can be overridden individually."""
    signal_strength: int = 85
    traffic_level: int = 1       # 0=low, 1=medium, 2=high
    is_active: bool = True


# Global per-bus configs
bus_configs: Dict[str, BusConfig] = {
    bus_id: BusConfig() for bus_id in BUS_DEFINITIONS
}


# ---------------------------------------------------------------------------
# Global SimConfig (shared parameters)
# ---------------------------------------------------------------------------

@dataclass
class SimConfig:
    """Global simulation parameters (Phase 2+3)."""

    # Network (global baseline; per-bus overrides in bus_configs)
    packet_loss: int = 5
    latency_ms: int = 100

    # Environment
    weather: int = 0                  # 0=clear, 1=cloudy, 2=rain

    # System
    buffer_size_limit: int = 50
    interpolation_mode: str = "smooth"

    def to_dict(self) -> dict:
        return {
            "packet_loss": self.packet_loss,
            "latency_ms": self.latency_ms,
            "weather": self.weather,
            "buffer_size_limit": self.buffer_size_limit,
            "interpolation_mode": self.interpolation_mode,
        }


sim_config = SimConfig()


# ---------------------------------------------------------------------------
# Signal Strength Tiers
# ---------------------------------------------------------------------------

SIGNAL_TIERS = {
    "excellent": {"min": 70, "max": 100, "interval_s": 2},
    "good":      {"min": 40, "max": 70,  "interval_s": 6},
    "poor":      {"min": 10, "max": 40,  "interval_s": 12},
    "dead":      {"min": 0,  "max": 10,  "interval_s": None},
}


def get_ping_interval(signal_strength: int) -> Optional[float]:
    """Ping interval in seconds for a given signal strength."""
    if signal_strength >= 70:
        return 2.0
    elif signal_strength >= 40:
        return 6.0
    elif signal_strength >= 10:
        return 12.0
    else:
        return None


def get_effective_ping_interval(signal_strength: int, packet_loss: int) -> Optional[float]:
    """Ping interval factoring in packet loss."""
    base = get_ping_interval(signal_strength)
    if base is None:
        return None
    loss_factor = 1.0 + (packet_loss / 100.0) * 0.5
    return base * loss_factor


def get_traffic_label(level: int) -> str:
    return {0: "low", 1: "medium", 2: "high"}.get(level, "medium")


def get_traffic_color(level: int) -> str:
    return {0: "#22c55e", 1: "#eab308", 2: "#ef4444"}.get(level, "#eab308")


# ---------------------------------------------------------------------------
# Geo-math Helpers
# ---------------------------------------------------------------------------

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def bearing_degrees(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlam = math.radians(lon2 - lon1)
    x = math.sin(dlam) * math.cos(phi2)
    y = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlam)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


# ---------------------------------------------------------------------------
# Simulation Constants
# ---------------------------------------------------------------------------

SIMULATION_TICK_S: float = 0.5
HEARTBEAT_INTERVAL_S: float = 1.0
DEFAULT_SIGNAL_STRENGTH: int = 85
