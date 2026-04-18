"""
config.py — Phase 5: 5 buses, 5 routes, MITAOE destination, dead zones.
"""

import copy

# ── MITAOE Destination (all routes terminate here) ──────────────
MITAOE_DESTINATION = {
    "name": "MIT Academy of Engineering, Alandi",
    "lat": 18.6828,
    "lng": 74.1190,
    "stop_id": "MITAOE_MAIN_GATE",
}

# ── 5 Route Definitions ────────────────────────────────────────
ROUTES = {
    "route_purple": {
        "id": "route_purple",
        "name": "MIT AOE Campus Loop",
        "color": "#a855f7",
        "stops": [
            {"name": "Shivajinagar Bus Stand", "lat": 18.5308, "lng": 73.8474},
            {"name": "Deccan Gymkhana", "lat": 18.5180, "lng": 73.8414},
            {"name": "FC Road", "lat": 18.5262, "lng": 73.8389},
            {"name": "JM Road", "lat": 18.5195, "lng": 73.8553},
            {"name": "Bund Garden", "lat": 18.5340, "lng": 73.8759},
            {"name": "Koregaon Park", "lat": 18.5367, "lng": 73.8936},
            {"name": "Kalyani Nagar", "lat": 18.5467, "lng": 73.9061},
            {"name": "Viman Nagar", "lat": 18.5679, "lng": 73.9143},
            {"name": "Dhanori", "lat": 18.5878, "lng": 73.9085},
            {"name": MITAOE_DESTINATION["name"], "lat": MITAOE_DESTINATION["lat"], "lng": MITAOE_DESTINATION["lng"]},
        ],
    },
    "route_teal": {
        "id": "route_teal",
        "name": "Hinjewadi Tech Corridor",
        "color": "#14b8a6",
        "stops": [
            {"name": "Hinjewadi Phase 3", "lat": 18.5912, "lng": 73.7389},
            {"name": "Hinjewadi Phase 1", "lat": 18.5876, "lng": 73.7397},
            {"name": "Wakad", "lat": 18.5989, "lng": 73.7598},
            {"name": "Baner", "lat": 18.5590, "lng": 73.7868},
            {"name": "Aundh", "lat": 18.5580, "lng": 73.8077},
            {"name": "University Circle", "lat": 18.5540, "lng": 73.8260},
            {"name": "Shivajinagar", "lat": 18.5308, "lng": 73.8474},
            {"name": "Sangamwadi", "lat": 18.5412, "lng": 73.8645},
            {"name": "Yerwada", "lat": 18.5545, "lng": 73.8976},
            {"name": MITAOE_DESTINATION["name"], "lat": MITAOE_DESTINATION["lat"], "lng": MITAOE_DESTINATION["lng"]},
        ],
    },
    "route_orange": {
        "id": "route_orange",
        "name": "Hadapsar-Katraj Ring",
        "color": "#f97316",
        "stops": [
            {"name": "Hadapsar Bus Stand", "lat": 18.5089, "lng": 73.9259},
            {"name": "Magarpatta City", "lat": 18.5146, "lng": 73.9274},
            {"name": "Fatima Nagar", "lat": 18.5067, "lng": 73.9009},
            {"name": "Kondhwa", "lat": 18.4880, "lng": 73.8943},
            {"name": "NIBM Road", "lat": 18.4738, "lng": 73.8850},
            {"name": "Undri", "lat": 18.4621, "lng": 73.8761},
            {"name": "Katraj", "lat": 18.4521, "lng": 73.8598},
            {"name": "Sinhagad Road", "lat": 18.4892, "lng": 73.8210},
            {"name": "Warje", "lat": 18.4892, "lng": 73.7956},
            {"name": MITAOE_DESTINATION["name"], "lat": MITAOE_DESTINATION["lat"], "lng": MITAOE_DESTINATION["lng"]},
        ],
    },
    "route_crimson": {
        "id": "route_crimson",
        "name": "Katraj Ghat Mountain Pass",
        "color": "#ef4444",
        "stops": [
            {"name": "Katraj Bus Stand", "lat": 18.4521, "lng": 73.8598},
            {"name": "Katraj Ghat Entry", "lat": 18.4380, "lng": 73.8502},
            {"name": "Katraj Ghat Mid", "lat": 18.4250, "lng": 73.8445},
            {"name": "Katraj Ghat Exit", "lat": 18.4180, "lng": 73.8390},
            {"name": "Navale Bridge", "lat": 18.4590, "lng": 73.7801},
            {"name": "Nanded City Village Patch", "lat": 18.4701, "lng": 73.7652},
            {"name": "Warje", "lat": 18.4892, "lng": 73.7956},
            {"name": "Chandani Chowk", "lat": 18.5195, "lng": 73.7612},
            {"name": "Wakad Junction", "lat": 18.5989, "lng": 73.7598},
            {"name": MITAOE_DESTINATION["name"], "lat": MITAOE_DESTINATION["lat"], "lng": MITAOE_DESTINATION["lng"]},
        ],
    },
    "route_amber": {
        "id": "route_amber",
        "name": "Pune City Far-Rural",
        "color": "#f59e0b",
        "stops": [
            {"name": "Pune Central (Camp)", "lat": 18.5195, "lng": 73.8799},
            {"name": "Yerwada", "lat": 18.5545, "lng": 73.8976},
            {"name": "Vishrantwadi", "lat": 18.5876, "lng": 73.9012},
            {"name": "Bhosari MIDC", "lat": 18.6290, "lng": 73.8475},
            {"name": "Moshi Phata", "lat": 18.6712, "lng": 73.8521},
            {"name": "Moshi Village", "lat": 18.6891, "lng": 73.8498},
            {"name": "Chikhali", "lat": 18.6998, "lng": 73.8012},
            {"name": "Dehu Road", "lat": 18.7201, "lng": 73.7621},
            {"name": "Alandi Village", "lat": 18.7098, "lng": 74.1012},
            {"name": MITAOE_DESTINATION["name"], "lat": MITAOE_DESTINATION["lat"], "lng": MITAOE_DESTINATION["lng"]},
        ],
    },
}

# ── 5 Bus Definitions ──────────────────────────────────────────
BUSES = {
    "bus_01": {
        "id": "bus_01",
        "route_id": "route_purple",
        "label": "MIT-01",
        "route_name": "MIT AOE Campus Loop",
        "base_speed_kmh": 35,
        "color": "#a855f7",
    },
    "bus_02": {
        "id": "bus_02",
        "route_id": "route_teal",
        "label": "HIN-02",
        "route_name": "Hinjewadi Tech Corridor",
        "base_speed_kmh": 30,
        "color": "#14b8a6",
    },
    "bus_03": {
        "id": "bus_03",
        "route_id": "route_orange",
        "label": "HAD-03",
        "route_name": "Hadapsar-Katraj Ring",
        "base_speed_kmh": 38,
        "color": "#f97316",
    },
    "bus_04": {
        "id": "bus_04",
        "route_id": "route_crimson",
        "label": "KAT-04",
        "route_name": "Katraj Ghat Mountain Pass",
        "base_speed_kmh": 28,
        "color": "#ef4444",
    },
    "bus_05": {
        "id": "bus_05",
        "route_id": "route_amber",
        "label": "PUN-05",
        "route_name": "Pune City Far-Rural",
        "base_speed_kmh": 32,
        "color": "#f59e0b",
    },
}

# ── Per-bus runtime config (mutable) ───────────────────────────
class BusConfig:
    def __init__(self, bus_def: dict):
        self.bus_id = bus_def["id"]
        self.signal_strength = 85
        self.packet_loss = 5
        self.latency_ms = 100
        self.traffic_level = 1  # 0=low, 1=medium, 2=high
        self.weather = 0  # 0=clear, 1=cloudy, 2=rain
        self.base_speed_kmh = bus_def["base_speed_kmh"]
        self.bus_speed_override = 0
        self.buffer_size_limit = 50
        self.interpolation_mode = "smooth"

# ── Global simulation config ───────────────────────────────────
class SimConfig:
    def __init__(self):
        self.bus_configs: dict[str, BusConfig] = {}
        for bus_id, bus_def in BUSES.items():
            self.bus_configs[bus_id] = BusConfig(bus_def)

    def get_bus_config(self, bus_id: str) -> BusConfig:
        return self.bus_configs.get(bus_id)

    def update(self, data: dict, bus_id: str | None = None):
        """Update config for a specific bus or all buses."""
        targets = [bus_id] if bus_id and bus_id in self.bus_configs else list(self.bus_configs.keys())
        for bid in targets:
            cfg = self.bus_configs[bid]
            if "signal_strength" in data:
                cfg.signal_strength = data["signal_strength"]
            if "packet_loss" in data:
                cfg.packet_loss = data["packet_loss"]
            if "latency_ms" in data:
                cfg.latency_ms = data["latency_ms"]
            if "traffic_level" in data:
                cfg.traffic_level = data["traffic_level"]
            if "weather" in data:
                cfg.weather = data["weather"]
            if "bus_speed_override" in data:
                cfg.bus_speed_override = data["bus_speed_override"]
            if "buffer_size_limit" in data:
                cfg.buffer_size_limit = data["buffer_size_limit"]
            if "interpolation_mode" in data:
                cfg.interpolation_mode = data["interpolation_mode"]


# Traffic color mapping
TRAFFIC_COLORS = {0: "#22c55e", 1: "#eab308", 2: "#ef4444"}
TRAFFIC_LABELS = {0: "low", 1: "medium", 2: "high"}

# Signal color mapping
def get_signal_color(signal: int) -> str:
    if signal >= 70:
        return "#22c55e"
    if signal >= 40:
        return "#eab308"
    return "#ef4444"
