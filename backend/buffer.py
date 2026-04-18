"""
Store-and-Forward Ping Buffer.

When signal strength drops below the dead-zone threshold (< 10 %),
GPS pings are stored here with their original timestamps intact.
Once the signal recovers, the buffer is flushed to the frontend so
it can reconstruct the actual path taken during the blackout.
"""

from typing import Any, Dict, List
import threading


class PingBuffer:
    """Thread-safe in-memory buffer for GPS pings during signal loss."""

    def __init__(self) -> None:
        self._buffer: List[Dict[str, Any]] = []
        self._lock = threading.Lock()

    def store(self, ping: Dict[str, Any]) -> None:
        """
        Append a ping to the buffer.
        Each ping must include a 'timestamp' field so the frontend can
        reconstruct the timeline when the buffer is flushed.
        """
        with self._lock:
            self._buffer.append(ping)

    def flush(self) -> List[Dict[str, Any]]:
        """
        Return all buffered pings and clear the buffer.
        The returned list is ordered chronologically (oldest first).
        """
        with self._lock:
            pings = self._buffer.copy()
            self._buffer.clear()
            return pings

    @property
    def size(self) -> int:
        """Number of pings currently sitting in the buffer."""
        with self._lock:
            return len(self._buffer)

    def peek(self) -> List[Dict[str, Any]]:
        """Read buffered pings without clearing (useful for debugging)."""
        with self._lock:
            return self._buffer.copy()
