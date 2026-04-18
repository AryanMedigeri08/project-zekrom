"""
System Decision Logger — Phase 3 (bus_id aware).

Captures timestamped system events with optional bus_id context.
"""

from collections import deque
from datetime import datetime, timezone
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import threading


@dataclass
class LogEntry:
    timestamp: str
    level: str       # "info" | "warn" | "critical"
    message: str
    bus_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = {"timestamp": self.timestamp, "level": self.level, "message": self.message}
        if self.bus_id:
            d["bus_id"] = self.bus_id
        return d


class SystemLogger:
    """Thread-safe ring-buffer logger with bus_id support."""

    def __init__(self, max_entries: int = 80) -> None:
        self._entries: deque[LogEntry] = deque(maxlen=max_entries)
        self._lock = threading.Lock()

    def _now(self) -> str:
        return datetime.now(timezone.utc).strftime("%H:%M:%S")

    def log(self, message: str, level: str = "info", bus_id: Optional[str] = None) -> None:
        entry = LogEntry(timestamp=self._now(), level=level, message=message, bus_id=bus_id)
        with self._lock:
            self._entries.append(entry)

    def info(self, msg: str, bus_id: Optional[str] = None): self.log(msg, "info", bus_id)
    def warn(self, msg: str, bus_id: Optional[str] = None): self.log(msg, "warn", bus_id)
    def critical(self, msg: str, bus_id: Optional[str] = None): self.log(msg, "critical", bus_id)

    def get_recent(self, count: int = 20, bus_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self._lock:
            entries = list(self._entries)
        if bus_id:
            entries = [e for e in entries if e.bus_id is None or e.bus_id == bus_id]
        return [e.to_dict() for e in entries[-count:]]

    # Convenience methods
    def signal_changed(self, bus_id: str, old: int, new: int):
        label = bus_id.upper().replace("_", "-")
        direction = "up" if new > old else "down"
        if new < 10:
            self.critical(f"[{label}] Signal dropped to {new}%. Dead zone — buffering.", bus_id)
        elif new < 40:
            self.warn(f"[{label}] Signal {direction} to {new}%. Sparse mode (12s).", bus_id)
        elif new < 70:
            self.info(f"[{label}] Signal {direction} to {new}%. Good mode (6s).", bus_id)
        else:
            self.info(f"[{label}] Signal {direction} to {new}%. Excellent (2s).", bus_id)

    def buffer_storing(self, bus_id: str, count: int):
        if count > 0 and count % 5 == 0:
            self.warn(f"[{bus_id.upper()}] {count} pings buffered offline.", bus_id)

    def buffer_flushed(self, bus_id: str, count: int):
        self.info(f"[{bus_id.upper()}] Signal restored — flushing {count} pings.", bus_id)

    def ghost_activated(self, bus_id: str):
        self.warn(f"[{bus_id.upper()}] Ghost bus activated.", bus_id)

    def ghost_deactivated(self, bus_id: str):
        self.info(f"[{bus_id.upper()}] Ghost deactivated — live tracking resumed.", bus_id)

    def sim_config_applied(self, key: str, value: Any, bus_id: Optional[str] = None):
        target = f"[{bus_id.upper()}]" if bus_id else "[ALL]"
        self.info(f"{target} Config: {key} -> {value}", bus_id)

    def scenario_applied(self, name: str, bus_id: Optional[str] = None):
        target = f"[{bus_id.upper()}]" if bus_id else "[ALL]"
        self.info(f"{target} Scenario applied: {name}", bus_id)


system_logger = SystemLogger()
