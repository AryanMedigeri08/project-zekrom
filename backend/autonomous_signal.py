"""
autonomous_signal.py — Phase 9: Autonomous signal model for Live Map.

Generates realistic signal variation without any slider input.
Based on position along route, route type, and time of day.

Key behaviors:
  - Route Crimson (KAT-04) naturally has weak signal in Katraj Ghat → ghost mode auto
  - Route Amber (PUN-05) has intermittent drops through rural sections
  - City routes (Purple, Teal, Orange) stay healthy with mild variation
  - Rush hour degrades signal (network congestion simulation)
"""

import random
from datetime import datetime
from typing import Optional

from config import BUSES
from dead_zones import get_active_dead_zone


# ── Base signal levels per route (higher = better connectivity) ──
ROUTE_BASE_SIGNAL = {
    "route_purple": 85,   # city route — strong
    "route_teal": 80,     # tech corridor — strong
    "route_orange": 78,   # ring road — decent
    "route_crimson": 55,  # ghat route — weak baseline
    "route_amber": 60,    # rural route — weak baseline
}


class AutonomousSignalModel:
    """
    Generates realistic signal variation for the live map.
    Based on position along route, route type, and time of day.

    No human intervention. System decides everything.
    """

    def __init__(self):
        # Per-bus gaussian walk state
        self._signal_drift: dict[str, float] = {}

    def get_signal(
        self,
        bus_id: str,
        distance_km: float,
        route_id: str,
        stop_index: int,
    ) -> float:
        """
        Compute signal strength for a bus on the live map.
        Returns signal in range [0, 100].
        """
        # Initialize drift if first call
        if bus_id not in self._signal_drift:
            base = ROUTE_BASE_SIGNAL.get(route_id, 80)
            self._signal_drift[bus_id] = float(base)

        # 1. Check known dead zones first (based on stop_index)
        dead_zone = get_active_dead_zone(route_id, stop_index)
        if dead_zone:
            if dead_zone["severity"] == "blackout":
                signal = random.uniform(0, 5)
                self._signal_drift[bus_id] = signal
                return signal
            else:
                lo, hi = dead_zone["signal_range"]
                signal = random.uniform(lo, hi)
                self._signal_drift[bus_id] = signal
                return signal

        # 2. Base signal from route type
        base = ROUTE_BASE_SIGNAL.get(route_id, 80)

        # 3. Time-of-day effects (rush hour degrades signal via congestion)
        hour = datetime.now().hour
        if 8 <= hour <= 10:
            base -= 15  # morning rush
        elif 17 <= hour <= 19:
            base -= 12  # evening rush

        # 4. Gaussian random walk for realism
        # Small perturbation each tick — signal drifts naturally
        self._signal_drift[bus_id] += random.gauss(0, 2.5)

        # Pull drift toward the route's natural base signal
        drift = self._signal_drift[bus_id]
        pull_strength = 0.05  # gentle mean reversion
        drift += (base - drift) * pull_strength

        # Clamp
        drift = max(0, min(100, drift))
        self._signal_drift[bus_id] = drift

        return round(drift, 1)


# Singleton
autonomous_signal_model = AutonomousSignalModel()
