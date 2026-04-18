"""
Per-Bus Ping Buffer — Store-and-forward system for multi-bus setup.

Each bus has its own independent buffer that stores pings during
signal dead zones and flushes them when connectivity recovers.
"""

import threading
from typing import Dict, List, Any


class PingBuffer:
    """Thread-safe FIFO ping buffer for a single bus."""

    def __init__(self, max_size: int = 50) -> None:
        self._buffer: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._max_size = max_size

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._buffer)

    def store(self, ping: Dict[str, Any]) -> bool:
        """Store a ping. Returns False if buffer is full."""
        with self._lock:
            if len(self._buffer) >= self._max_size:
                return False
            self._buffer.append(ping)
            return True

    def flush(self) -> List[Dict[str, Any]]:
        """Drain all buffered pings, preserving original order."""
        with self._lock:
            flushed = list(self._buffer)
            self._buffer.clear()
            return flushed

    def set_max_size(self, new_max: int) -> None:
        with self._lock:
            self._max_size = new_max


class BusBufferManager:
    """
    Manages one PingBuffer per bus.
    Created at startup with one buffer per bus_id.
    """

    def __init__(self, bus_ids: List[str], default_max: int = 50) -> None:
        self._buffers: Dict[str, PingBuffer] = {
            bus_id: PingBuffer(max_size=default_max) for bus_id in bus_ids
        }

    def get(self, bus_id: str) -> PingBuffer:
        return self._buffers[bus_id]

    def store(self, bus_id: str, ping: Dict[str, Any]) -> bool:
        return self._buffers[bus_id].store(ping)

    def flush(self, bus_id: str) -> List[Dict[str, Any]]:
        return self._buffers[bus_id].flush()

    def size(self, bus_id: str) -> int:
        return self._buffers[bus_id].size

    def set_all_max_size(self, new_max: int) -> None:
        for buf in self._buffers.values():
            buf.set_max_size(new_max)

    def all_sizes(self) -> Dict[str, int]:
        return {bid: buf.size for bid, buf in self._buffers.items()}
