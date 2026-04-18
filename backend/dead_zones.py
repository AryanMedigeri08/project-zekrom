"""
dead_zones.py — Known dead zone definitions for Pune transit routes.

Each zone describes a historically confirmed area of poor or no signal,
with metadata for AI explainability and confidence scoring.
"""

DEAD_ZONES = [
    {
        "zone_id": "dz_katraj_ghat",
        "name": "Katraj Ghat Mountain Pass",
        "route_ids": ["route_crimson"],
        "severity": "blackout",
        "signal_range": [0, 5],
        "affected_stop_indices": [2, 3],
        "reason": (
            "Dense mountain terrain with no cell tower line-of-sight. "
            "Historical data shows 98% packet loss between Katraj Ghat "
            "Entry and Exit (2.3 km stretch). Average blackout duration: "
            "4.2 minutes."
        ),
        "historical_blackout_rate": 0.98,
        "avg_duration_minutes": 4.2,
        "confidence_score": 0.94,
    },
    {
        "zone_id": "dz_nanded_village",
        "name": "Nanded City Village Patch",
        "route_ids": ["route_crimson"],
        "severity": "weak",
        "signal_range": [15, 30],
        "affected_stop_indices": [5],
        "reason": (
            "Rural village area with single weak 2G tower. Historical "
            "data shows consistent signal degradation to 15-30%. "
            "Packet loss averages 45%."
        ),
        "historical_blackout_rate": 0.45,
        "avg_duration_minutes": 1.8,
        "confidence_score": 0.87,
    },
    {
        "zone_id": "dz_bhosari_midc",
        "name": "Bhosari Industrial Zone",
        "route_ids": ["route_amber"],
        "severity": "weak",
        "signal_range": [20, 40],
        "affected_stop_indices": [3],
        "reason": (
            "Dense industrial infrastructure causes RF interference. "
            "Metal structures and warehouse roofing create consistent "
            "signal attenuation. Historical rate: 67% degraded pings "
            "in this zone."
        ),
        "historical_blackout_rate": 0.67,
        "avg_duration_minutes": 2.1,
        "confidence_score": 0.89,
    },
    {
        "zone_id": "dz_moshi_village",
        "name": "Moshi Village Rural Stretch",
        "route_ids": ["route_amber"],
        "severity": "blackout",
        "signal_range": [0, 8],
        "affected_stop_indices": [5],
        "reason": (
            "Remote village with no tower within 4km. Historical data: "
            "complete signal loss for 100% of trips through this segment. "
            "Buffer activates automatically. Ghost bus mode engages "
            "immediately."
        ),
        "historical_blackout_rate": 1.0,
        "avg_duration_minutes": 3.1,
        "confidence_score": 0.99,
    },
]


def get_dead_zones_for_route(route_id: str) -> list:
    """Return all dead zones that affect a given route."""
    return [dz for dz in DEAD_ZONES if route_id in dz["route_ids"]]


def get_active_dead_zone(route_id: str, stop_index: int) -> dict | None:
    """Check if the current stop_index is inside a dead zone."""
    for dz in DEAD_ZONES:
        if route_id in dz["route_ids"] and stop_index in dz["affected_stop_indices"]:
            return dz
    return None


def compute_confidence_score(
    signal_strength: float,
    in_dead_zone: bool,
    active_zone: dict | None,
    packet_loss_rate: float,
    is_buffering: bool,
) -> float:
    """Compute a 0.05–1.0 confidence score for a bus's current state."""
    base = signal_strength / 100.0

    if in_dead_zone and active_zone:
        base *= 1 - active_zone["historical_blackout_rate"] * 0.5

    base *= 1 - packet_loss_rate * 0.3

    if is_buffering:
        base *= 0.7

    return round(max(0.05, min(1.0, base)), 2)
