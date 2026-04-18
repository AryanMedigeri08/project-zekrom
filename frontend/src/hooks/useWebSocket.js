/**
 * useWebSocket — Auto-reconnecting WebSocket hook for the transport tracker.
 *
 * Connects to the backend WebSocket at ws://localhost:8000/ws/client.
 * Automatically reconnects with exponential backoff on disconnect.
 * Provides parsed message stream and connection status.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'ws://localhost:8000/ws/client';
const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 10000;

export default function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [route, setRoute] = useState([]);
  const [busPosition, setBusPosition] = useState(null);
  const [signalStrength, setSignalStrength] = useState(85);
  const [bufferSize, setBufferSize] = useState(0);
  const [bufferedPings, setBufferedPings] = useState([]);
  const [lastPingTime, setLastPingTime] = useState(null);
  const [signalHistory, setSignalHistory] = useState([]);

  const wsRef = useRef(null);
  const retryDelayRef = useRef(INITIAL_RETRY_MS);
  const retryTimerRef = useRef(null);
  const mountedRef = useRef(true);

  // ---------------------------------------------------------------
  // Message Handler
  // ---------------------------------------------------------------
  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.data);
      setLastMessage(msg);

      switch (msg.type) {
        case 'init':
          // Initial payload: route definition + current bus state
          if (msg.route) setRoute(msg.route);
          if (msg.bus) {
            setBusPosition(msg.bus);
            setLastPingTime(new Date().toISOString());
          }
          if (msg.signal_strength != null) setSignalStrength(msg.signal_strength);
          if (msg.buffer_size != null) setBufferSize(msg.buffer_size);
          break;

        case 'position_update':
          // Normal GPS ping
          if (msg.data) {
            setBusPosition(msg.data);
            setLastPingTime(new Date().toISOString());
          }
          if (msg.buffer_size != null) setBufferSize(msg.buffer_size);
          break;

        case 'buffer_flush':
          // Buffered pings arriving after signal recovery
          if (msg.pings && msg.pings.length > 0) {
            setBufferedPings(msg.pings);
            // Set position to the latest flushed ping
            const latest = msg.pings[msg.pings.length - 1];
            setBusPosition(latest);
            setLastPingTime(new Date().toISOString());
          }
          if (msg.buffer_size != null) setBufferSize(msg.buffer_size);
          break;

        case 'signal_update':
          if (msg.signal_strength != null) setSignalStrength(msg.signal_strength);
          if (msg.buffer_size != null) setBufferSize(msg.buffer_size);
          break;

        case 'heartbeat':
          // Periodic signal-strength heartbeat for the waveform panel
          if (msg.signal_strength != null) setSignalStrength(msg.signal_strength);
          if (msg.buffer_size != null) setBufferSize(msg.buffer_size);
          // Append to signal history (sliding window of 30)
          setSignalHistory((prev) => {
            const next = [
              ...prev,
              {
                time: new Date().toLocaleTimeString(),
                value: msg.signal_strength,
                timestamp: Date.now(),
              },
            ];
            return next.slice(-30);
          });
          break;

        default:
          break;
      }
    } catch (err) {
      console.warn('[WS] Failed to parse message:', err);
    }
  }, []);

  // ---------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      setIsConnected(true);
      retryDelayRef.current = INITIAL_RETRY_MS; // reset backoff
    };

    ws.onmessage = handleMessage;

    ws.onclose = (e) => {
      console.log('[WS] Disconnected', e.code, e.reason);
      setIsConnected(false);
      scheduleReconnect();
    };

    ws.onerror = (err) => {
      console.warn('[WS] Error:', err);
      ws.close();
    };
  }, [handleMessage]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    const delay = retryDelayRef.current;
    console.log(`[WS] Reconnecting in ${delay}ms...`);
    retryTimerRef.current = setTimeout(() => {
      retryDelayRef.current = Math.min(delay * 1.5, MAX_RETRY_MS);
      connect();
    }, delay);
  }, [connect]);

  // ---------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Provide a way to clear buffered pings after consumption
  const clearBufferedPings = useCallback(() => setBufferedPings([]), []);

  return {
    isConnected,
    lastMessage,
    route,
    busPosition,
    signalStrength,
    bufferSize,
    bufferedPings,
    clearBufferedPings,
    lastPingTime,
    signalHistory,
  };
}
