"""
System Decision Logger.

Captures timestamped system events (signal changes, buffer activity,
mode switches) for display in the frontend's System Decision Log panel.

Designed to be used server-side — the frontend polls /api/system-log
every 2 seconds.
"""

from collections import deque
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import List, Dict, Any
import threading


@dataclass
class LogEntry:
    """One system decision event."""
    timestamp: str       # ISO-8601
    level: str           # "info" | "warn" | "critical"
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "level": self.level,
            "message": self.message,
        }


class SystemLogger:
    """
    Thread-safe ring-buffer logger.

    Stores the last `max_entries` system decisions.  The frontend polls
    these periodically to render the decision-log panel.
    """

    def __init__(self, max_entries: int = 50) -> None:
        self._entries: deque[LogEntry] = deque(maxlen=max_entries)
        self._lock = threading.Lock()

    def _now(self) -> str:
        return datetime.now(timezone.utc).strftime("%H:%M:%S")

    def log(self, message: str, level: str = "info") -> None:
        """Append a new log entry."""
        entry = LogEntry(
            timestamp=self._now(),
            level=level,
            message=message,
        )
        with self._lock:
            self._entries.append(entry)

    def info(self, message: str) -> None:
        self.log(message, "info")

    def warn(self, message: str) -> None:
        self.log(message, "warn")

    def critical(self, message: str) -> None:
        self.log(message, "critical")

    def get_recent(self, count: int = 20) -> List[Dict[str, Any]]:
        """Return the last `count` entries as dicts (newest last)."""
        with self._lock:
            entries = list(self._entries)
        return [e.to_dict() for e in entries[-count:]]

    # ------------------------------------------------------------------
    # Convenience methods for common events
    # ------------------------------------------------------------------

    def signal_changed(self, old: int, new: int) -> None:
        """Log a signal strength change with appropriate level."""
        direction = "↑" if new > old else "↓"
        if new < 10:
            self.critical(
                f"Signal dropped to {new}%. Entering dead zone — "
                f"pings will be buffered."
            )
        elif new < 40:
            self.warn(
                f"Signal {direction} to {new}%. Switching to sparse mode. "
                f"Ping interval → 12s"
            )
        elif new < 70:
            self.info(
                f"Signal {direction} to {new}%. Moderate quality. "
                f"Ping interval → 6s"
            )
        else:
            self.info(
                f"Signal {direction} to {new}%. Excellent quality. "
                f"Ping interval → 2s"
            )

    def buffer_storing(self, buffer_size: int) -> None:
        if buffer_size % 5 == 0 and buffer_size > 0:  # log every 5 pings
            pct = min(100, int(buffer_size / 50 * 100))  # assume default cap=50
            self.warn(
                f"Buffer capacity at {pct}%. {buffer_size} pings stored offline."
            )

    def buffer_flushed(self, count: int) -> None:
        self.info(
            f"Signal restored. Flushing {count} buffered pings to frontend."
        )

    def ghost_activated(self) -> None:
        self.warn("Ghost bus activated — showing estimated position on map.")

    def ghost_deactivated(self) -> None:
        self.info("Ghost bus deactivated — live tracking resumed.")

    def sim_config_applied(self, key: str, value: Any) -> None:
        self.info(f"Simulation config updated: {key} → {value}")

    def scenario_applied(self, name: str) -> None:
        self.info(f"Preset scenario applied: {name}")


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

system_logger = SystemLogger()
