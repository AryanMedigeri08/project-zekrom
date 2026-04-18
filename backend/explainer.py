"""
explainer.py — AI Decision Explainability engine.

Every automated system decision (ghost activation, buffer flush,
interval change, ETA recalculation) gets a structured explanation
with confidence score, reasoning, and expected duration.
"""


class DecisionExplainer:
    """Generates human-readable explanations for system decisions."""

    def explain_ghost_activation(self, bus_state: dict, zone: dict | None = None) -> dict:
        label = bus_state.get("label", bus_state.get("bus_id", "?"))
        signal = bus_state.get("signal_strength", 0)
        speed = bus_state.get("speed_kmh", 0)
        heading = bus_state.get("heading_degrees", 0)

        if zone:
            return {
                "decision": "Ghost Bus Activated",
                "trigger": "Dead Zone Entry",
                "bus_id": bus_state.get("bus_id"),
                "reasoning": (
                    f"Bus {label} has entered '{zone['name']}', a historically "
                    f"confirmed signal blackout zone (confidence: "
                    f"{zone['confidence_score']*100:.0f}%). Signal dropped to "
                    f"{signal}% which is below the 10% ghost activation threshold. "
                    f"Based on {zone['historical_blackout_rate']*100:.0f}% historical "
                    f"packet loss rate, real pings are unreliable. Ghost bus now "
                    f"extrapolates position using last known speed ({speed:.1f} km/h) "
                    f"and heading ({heading:.1f} deg)."
                ),
                "confidence": zone["confidence_score"],
                "action": "Ghost mode ON. Buffer active. ETA cone widened to +/-40%.",
                "expected_duration": f"{zone['avg_duration_minutes']} min",
            }
        else:
            return {
                "decision": "Ghost Bus Activated",
                "trigger": "Signal Below Threshold",
                "bus_id": bus_state.get("bus_id"),
                "reasoning": (
                    f"Signal dropped to {signal}% (threshold: 10%). No historical "
                    f"dead zone pattern detected for this location. May be a "
                    f"transient network issue. Ghost bus activated as a precaution "
                    f"using linear extrapolation from last 5 position samples."
                ),
                "confidence": 0.65,
                "action": "Ghost mode ON. Monitoring for signal recovery.",
                "expected_duration": "Unknown",
            }

    def explain_buffer_flush(self, bus_state: dict, pings_flushed: int, blackout_duration: float = 0) -> dict:
        label = bus_state.get("label", bus_state.get("bus_id", "?"))
        signal = bus_state.get("signal_strength", 0)
        return {
            "decision": "Buffer Flush Executed",
            "trigger": "Signal Restored",
            "bus_id": bus_state.get("bus_id"),
            "reasoning": (
                f"Signal for {label} recovered to {signal}% (above 15% recovery "
                f"threshold). {pings_flushed} buffered pings accumulated during "
                f"{blackout_duration:.1f}s blackout. Flushing in chronological order "
                f"to reconstruct actual path. Ghost bus will be deactivated after "
                f"flush completes."
            ),
            "confidence": 0.98,
            "action": f"Flushing {pings_flushed} pings. Ghost deactivating. Map reconciling.",
            "expected_duration": f"{pings_flushed * 0.1:.1f}s",
        }

    def explain_ping_interval_change(self, bus_state: dict, old_interval: float, new_interval: float) -> dict:
        label = bus_state.get("label", bus_state.get("bus_id", "?"))
        signal = bus_state.get("signal_strength", 0)
        prev_signal = bus_state.get("prev_signal", signal)
        return {
            "decision": "Ping Interval Adjusted",
            "trigger": "Signal Strength Change",
            "bus_id": bus_state.get("bus_id"),
            "reasoning": (
                f"Signal for {label} changed from {prev_signal}% to {signal}%. "
                f"Adaptive algorithm recalculated optimal ping interval to balance "
                f"location accuracy against bandwidth conservation. Reducing frequency "
                f"preserves connection stability on weak networks."
            ),
            "confidence": 0.91,
            "action": f"Interval: {old_interval:.1f}s -> {new_interval:.1f}s. Payload compressed to minimal format.",
            "expected_duration": "Until signal changes",
        }

    def explain_eta_recalculation(self, bus_state: dict, old_eta: float, new_eta: float, reason: str = "Traffic Update") -> dict:
        label = bus_state.get("label", bus_state.get("bus_id", "?"))
        signal = bus_state.get("signal_strength", 85)
        speed = bus_state.get("speed_kmh", 0)
        traffic = bus_state.get("traffic_level", "medium")
        confidence = bus_state.get("eta_confidence", 0.8)
        return {
            "decision": "ETA Recalculated",
            "trigger": reason,
            "bus_id": bus_state.get("bus_id"),
            "reasoning": (
                f"ETA for {label} updated from {old_eta:.0f} to {new_eta:.0f} min. "
                f"Factors: current speed {speed:.1f} km/h, traffic {traffic}, "
                f"signal penalty {'applied' if signal < 70 else 'none'}. "
                f"ML model (GradientBoosting) confidence: {confidence*100:.0f}%."
            ),
            "confidence": confidence,
            "action": "ETA cone updated on timeline view.",
            "expected_duration": "N/A",
        }

    def explain_dead_zone_entry(self, bus_state: dict, zone: dict) -> dict:
        label = bus_state.get("label", bus_state.get("bus_id", "?"))
        return {
            "decision": "Dead Zone Entry",
            "trigger": "Geographic Position",
            "bus_id": bus_state.get("bus_id"),
            "reasoning": (
                f"Bus {label} has entered known dead zone '{zone['name']}'. "
                f"Severity: {zone['severity']}. Historical blackout rate: "
                f"{zone['historical_blackout_rate']*100:.0f}%. Expected duration: "
                f"{zone['avg_duration_minutes']} min. System will automatically "
                f"engage ghost mode and buffer if signal drops below threshold."
            ),
            "confidence": zone["confidence_score"],
            "action": f"Monitoring signal. Ghost standby. Buffer primed ({zone['severity']}).",
            "expected_duration": f"{zone['avg_duration_minutes']} min",
        }


# Singleton
explainer = DecisionExplainer()
