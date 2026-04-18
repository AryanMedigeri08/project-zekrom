/**
 * useWebSocket — Phase 6: Zekrom WS hook with notification callbacks.
 *
 * Stores: routes, buses, signalHistory, bufferedPings, deadZones, mitaoe.
 * Fires notification callbacks for ghost, dead zone, buffer flush, signal events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const WS_URL = 'ws://localhost:8000/ws/client';
const MAX_SIGNAL_HISTORY = 40;
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 15000;

export default function useWebSocket(notifyFn) {
  const [isConnected, setIsConnected] = useState(false);
  const [routes, setRoutes] = useState({});
  const [buses, setBuses] = useState({});
  const [signalHistory, setSignalHistory] = useState({});
  const [bufferedPings, setBufferedPings] = useState({});
  const [deadZones, setDeadZones] = useState([]);
  const [mitaoe, setMitaoe] = useState(null);

  const wsRef = useRef(null);
  const reconnectDelay = useRef(RECONNECT_DELAY_MS);
  const reconnectTimer = useRef(null);
  const tickCounter = useRef(0);
  const notifyRef = useRef(notifyFn);
  const prevBusState = useRef({}); // track state changes for notifications

  // Keep ref current
  useEffect(() => { notifyRef.current = notifyFn; }, [notifyFn]);

  const notify = useCallback((n) => { if (notifyRef.current) notifyRef.current(n); }, []);

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
        console.warn('[Zekrom] WS parse error:', e);
      }
    };
  }, []);

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'init': {
        if (msg.routes) setRoutes(msg.routes);
        if (msg.dead_zones) setDeadZones(msg.dead_zones);
        if (msg.mitaoe) setMitaoe(msg.mitaoe);

        if (msg.buses) {
          const busMap = {};
          for (const [busId, bdata] of Object.entries(msg.buses)) {
            const ping = bdata.last_ping;
            busMap[busId] = {
              id: busId,
              route_id: bdata.route_id,
              label: bdata.label,
              route_name: bdata.route_name,
              color: bdata.color,
              lat: ping?.lat ?? 0,
              lng: ping?.lng ?? 0,
              speed_kmh: ping?.speed_kmh ?? 0,
              heading: ping?.heading_degrees ?? 0,
              signal_strength: bdata.signal_strength ?? 85,
              traffic_level: bdata.traffic_level ?? 'medium',
              is_ghost: bdata.is_ghost ?? false,
              ghost_confidence: ping?.ghost_confidence ?? null,
              ping_type: ping?.ping_type ?? 'real',
              next_stop: ping?.next_stop ?? '',
              stop_index: ping?.stop_index ?? 0,
              route_progress: ping?.route_progress ?? 0,
              geometry_index: ping?.geometry_index ?? 0,
              buffer_size: bdata.buffer_size ?? 0,
              confidence_score: ping?.confidence_score ?? 0.8,
              in_dead_zone: false,
              dead_zone: ping?.dead_zone ?? null,
              explanation: ping?.explanation ?? null,
              timestamp: ping?.timestamp ?? '',
              trail: [],
            };
          }
          setBuses(busMap);
          prevBusState.current = Object.fromEntries(
            Object.entries(busMap).map(([id, b]) => [id, { is_ghost: b.is_ghost, signal_strength: b.signal_strength, in_dead_zone: false }])
          );
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

          const newBus = {
            ...old,
            id: busId,
            lat: data.lat,
            lng: data.lng,
            speed_kmh: data.speed_kmh,
            heading: data.heading_degrees,
            signal_strength: data.signal_strength,
            traffic_level: data.traffic_level,
            is_ghost: data.is_ghost || data.ping_type === 'ghost',
            ghost_confidence: data.ghost_confidence ?? null,
            ping_type: data.ping_type,
            next_stop: data.next_stop,
            stop_index: data.stop_index,
            route_progress: data.route_progress,
            geometry_index: data.geometry_index,
            buffer_size: msg.buffer_size ?? 0,
            confidence_score: data.confidence_score ?? old.confidence_score,
            in_dead_zone: !!data.dead_zone?.active,
            dead_zone: data.dead_zone ?? null,
            explanation: data.explanation ?? null,
            timestamp: data.timestamp,
            label: data.label || old.label,
            route_id: data.route_id || old.route_id,
            route_name: data.route_name || old.route_name,
            color: data.color || old.color,
            trail,
          };

          // Generate notifications on state changes
          const prevState = prevBusState.current[busId] || {};
          const busLabel = newBus.label || busId;

          if (newBus.is_ghost && !prevState.is_ghost) {
            notify({ type: 'ghost_activated', title: 'Ghost Bus Activated', message: `${busLabel} lost signal, switching to estimated tracking`, busLabel, bus_id: busId });
          }
          if (!newBus.is_ghost && prevState.is_ghost) {
            notify({ type: 'signal_restored', title: 'Signal Restored', message: `${busLabel} regained live signal`, busLabel, bus_id: busId });
          }
          if (newBus.in_dead_zone && !prevState.in_dead_zone) {
            const dzName = newBus.dead_zone?.name || 'Unknown';
            notify({ type: 'dead_zone_entry', title: 'Dead Zone Entry', message: `${busLabel} entered ${dzName}`, busLabel, bus_id: busId });
          }
          if (data.signal_strength < 40 && (prevState.signal_strength ?? 85) >= 40) {
            notify({ type: 'signal_weak', title: 'Signal Weak', message: `${busLabel} signal dropped to ${data.signal_strength}%`, busLabel, bus_id: busId });
          }

          prevBusState.current[busId] = { is_ghost: newBus.is_ghost, signal_strength: data.signal_strength, in_dead_zone: newBus.in_dead_zone };

          return { ...prev, [busId]: newBus };
        });

        tickCounter.current += 1;
        setSignalHistory((prev) => {
          const hist = [...(prev[busId] || [])];
          hist.push({ time: tickCounter.current, value: data.signal_strength, timestamp: Date.now() });
          if (hist.length > MAX_SIGNAL_HISTORY) hist.shift();
          return { ...prev, [busId]: hist };
        });
        break;
      }

      case 'buffer_flush': {
        const busId = msg.bus_id;
        if (!busId) break;
        setBufferedPings((prev) => ({ ...prev, [busId]: msg.pings || [] }));
        setBuses((prev) => {
          const busLabel = prev[busId]?.label || busId;
          notify({ type: 'buffer_flush', title: 'Buffer Flush', message: `${busLabel} flushed ${(msg.pings || []).length} buffered pings`, busLabel, bus_id: busId });
          return {
            ...prev,
            [busId]: { ...(prev[busId] || {}), is_ghost: false, buffer_size: 0 },
          };
        });
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
                  confidence_score: hb.confidence_score ?? next[busId].confidence_score,
                  in_dead_zone: hb.in_dead_zone ?? false,
                  dead_zone: hb.dead_zone ?? next[busId].dead_zone,
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
  }, [notify]);

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
    deadZones,
    mitaoe,
  };
}
