/**
 * useWebSocket — Multi-bus WebSocket hook.
 *
 * State:
 *   routes: { route_purple: { geometry, stops, ... }, ... }
 *   buses:  { bus_01: { lat, lng, signal, traffic, isGhost, label, ... }, ... }
 *   signalHistory: per-bus signal history for waveform
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = 'ws://localhost:8000/ws/client';
const MAX_SIGNAL_HISTORY = 40;
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 15000;

export default function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [routes, setRoutes] = useState({});
  const [buses, setBuses] = useState({});
  const [signalHistory, setSignalHistory] = useState({});   // { bus_id: [{time, value}] }
  const [bufferedPings, setBufferedPings] = useState({});    // { bus_id: [...pings] }

  const wsRef = useRef(null);
  const reconnectDelay = useRef(RECONNECT_DELAY_MS);
  const reconnectTimer = useRef(null);
  const tickCounter = useRef(0);

  const clearBufferedPings = useCallback((busId) => {
    setBufferedPings((prev) => ({ ...prev, [busId]: [] }));
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectDelay.current = RECONNECT_DELAY_MS;
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, MAX_RECONNECT_DELAY_MS);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => ws.close();

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.warn('[WS] Parse error:', e);
      }
    };
  }, []);

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'init': {
        // Set routes (with geometry)
        if (msg.routes) setRoutes(msg.routes);

        // Set initial bus states
        if (msg.buses) {
          const busMap = {};
          for (const [busId, bdata] of Object.entries(msg.buses)) {
            const ping = bdata.last_ping;
            busMap[busId] = {
              id: busId,
              route_id: bdata.route_id,
              label: bdata.label,
              lat: ping?.lat ?? 0,
              lng: ping?.lng ?? 0,
              speed_kmh: ping?.speed_kmh ?? 0,
              heading: ping?.heading_degrees ?? 0,
              signal_strength: bdata.signal_strength ?? 85,
              traffic_level: bdata.traffic_level ?? 'medium',
              is_ghost: bdata.is_ghost ?? false,
              ping_type: ping?.ping_type ?? 'real',
              next_stop: ping?.next_stop ?? '',
              stop_index: ping?.stop_index ?? 0,
              route_progress: ping?.route_progress ?? 0,
              geometry_index: ping?.geometry_index ?? 0,
              buffer_size: bdata.buffer_size ?? 0,
              timestamp: ping?.timestamp ?? '',
              trail: [],  // last 30 positions
            };
          }
          setBuses(busMap);
        }
        break;
      }

      case 'position_update': {
        const busId = msg.bus_id;
        const data = msg.data;
        if (!busId || !data) break;

        setBuses((prev) => {
          const old = prev[busId] || {};
          const trail = [...(old.trail || [])];
          if (data.lat && data.lng) {
            trail.push({ lat: data.lat, lng: data.lng });
            if (trail.length > 30) trail.shift();
          }

          return {
            ...prev,
            [busId]: {
              ...old,
              id: busId,
              lat: data.lat,
              lng: data.lng,
              speed_kmh: data.speed_kmh,
              heading: data.heading_degrees,
              signal_strength: data.signal_strength,
              traffic_level: data.traffic_level,
              is_ghost: data.ping_type === 'ghost',
              ping_type: data.ping_type,
              next_stop: data.next_stop,
              stop_index: data.stop_index,
              route_progress: data.route_progress,
              geometry_index: data.geometry_index,
              buffer_size: msg.buffer_size ?? 0,
              timestamp: data.timestamp,
              label: data.label || old.label,
              route_id: data.route_id || old.route_id,
              trail,
            },
          };
        });

        // Update signal history
        tickCounter.current += 1;
        setSignalHistory((prev) => {
          const hist = [...(prev[busId] || [])];
          hist.push({
            time: tickCounter.current,
            value: data.signal_strength,
            timestamp: Date.now(),
          });
          if (hist.length > MAX_SIGNAL_HISTORY) hist.shift();
          return { ...prev, [busId]: hist };
        });
        break;
      }

      case 'buffer_flush': {
        const busId = msg.bus_id;
        if (!busId) break;
        setBufferedPings((prev) => ({
          ...prev,
          [busId]: msg.pings || [],
        }));

        // Update bus ghost status
        setBuses((prev) => ({
          ...prev,
          [busId]: {
            ...(prev[busId] || {}),
            is_ghost: false,
            buffer_size: 0,
          },
        }));
        break;
      }

      case 'heartbeat': {
        if (msg.buses) {
          setBuses((prev) => {
            const next = { ...prev };
            for (const [busId, hb] of Object.entries(msg.buses)) {
              if (next[busId]) {
                next[busId] = {
                  ...next[busId],
                  signal_strength: hb.signal_strength,
                  buffer_size: hb.buffer_size,
                  is_ghost: hb.is_ghost,
                  traffic_level: hb.traffic_level,
                };
              }
            }
            return next;
          });
        }
        break;
      }

      default:
        break;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return {
    isConnected,
    routes,
    buses,
    signalHistory,
    bufferedPings,
    clearBufferedPings,
  };
}
