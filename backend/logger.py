"""
logger.py — Phase 5: System event logger with AI decision context.
"""

import time
from typing import Optional


class SystemLogger:
    """In-memory event logger. Stores last 200 entries."""

    def __init__(self, max_entries: int = 200):
        self._entries = []
        self._max = max_entries

    def log(self, level: str, message: str, bus_id: Optional[str] = None):
        entry = {
            "timestamp": time.strftime("%H:%M:%S"),
            "level": level,
            "message": message,
            "bus_id": bus_id,
        }
        self._entries.append(entry)
        if len(self._entries) > self._max:
            self._entries.pop(0)

    def info(self, message: str, bus_id: Optional[str] = None):
        self.log("info", message, bus_id)

    def warn(self, message: str, bus_id: Optional[str] = None):
        self.log("warn", message, bus_id)

    def critical(self, message: str, bus_id: Optional[str] = None):
        self.log("critical", message, bus_id)

    def signal_changed(self, bus_id: str, old: int, new: int):
        self.log("info", f"Signal: {old}% -> {new}%", bus_id)

    def ghost_activated(self, bus_id: str):
        self.log("critical", "Ghost bus activated — signal lost", bus_id)

    def ghost_deactivated(self, bus_id: str):
        self.log("info", "Ghost bus deactivated — signal restored", bus_id)

    def buffer_storing(self, bus_id: str, count: int):
        self.log("warn", f"Buffering ping (total: {count})", bus_id)

    def buffer_flushed(self, bus_id: str, count: int):
        self.log("info", f"Buffer flushed: {count} pings sent", bus_id)

    def sim_config_applied(self, key: str, value, bus_id: Optional[str] = None):
        target = bus_id or "all"
        self.log("info", f"Config: {key}={value} (target: {target})", bus_id)

    def dead_zone_entered(self, bus_id: str, zone_name: str):
        self.log("critical", f"Entered dead zone: {zone_name}", bus_id)

    def dead_zone_exited(self, bus_id: str, zone_name: str):
        self.log("info", f"Exited dead zone: {zone_name}", bus_id)

    def get_recent(self, n: int = 20, bus_id: Optional[str] = None):
        if bus_id:
            filtered = [e for e in self._entries if e.get("bus_id") == bus_id]
            return filtered[-n:]
        return self._entries[-n:]


system_logger = SystemLogger()
