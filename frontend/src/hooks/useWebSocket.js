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

            // Phase 8: Layer 1 — Adaptive Payload
            prev_signal: data.prev_signal ?? old.prev_signal ?? data.signal_strength,
            payload_size_bytes: data.payload_size_bytes ?? old.payload_size_bytes ?? 400,
            ping_interval_ms: data.ping_interval_ms ?? old.ping_interval_ms ?? 2000,
            bandwidth_saved_pct: data.bandwidth_saved_pct ?? old.bandwidth_saved_pct ?? 0,
            payload_history: data.payload_history ?? old.payload_history ?? [],

            // Phase 8: Layer 2 — Buffer
            buffer_count: data.buffer_count ?? old.buffer_count ?? 0,
            buffer_max: data.buffer_max ?? old.buffer_max ?? 50,
            is_flushing: data.is_flushing ?? false,
            flush_progress: data.flush_progress ?? 0,
            recent_buffered_pings: data.recent_buffered_pings ?? old.recent_buffered_pings ?? [],

            // Phase 8: Layer 3 — Ghost
            ghost_confidence_history: data.ghost_confidence_history ?? old.ghost_confidence_history ?? [],
            ghost_distance_traveled_km: data.ghost_distance_traveled_km ?? old.ghost_distance_traveled_km ?? 0,
            last_real_speed: data.last_real_speed ?? old.last_real_speed ?? data.speed_kmh,
            last_real_heading: data.last_real_heading ?? old.last_real_heading ?? 0,
            reconciliation_deviation_m: data.reconciliation_deviation_m ?? old.reconciliation_deviation_m ?? null,
            ghost_start_time: data.ghost_start_time ?? old.ghost_start_time ?? null,

            // Phase 8: Layer 4 — ETA
            eta_data_mode: data.eta_data_mode ?? old.eta_data_mode ?? 'live',
            eta_cone_width: data.eta_cone_width ?? old.eta_cone_width ?? 'narrow',
            eta_just_recalculated: data.eta_just_recalculated ?? false,

            // Phase 8: Layer 5 — Dead Zone
            approaching_dead_zone: data.approaching_dead_zone ?? false,
            distance_to_dead_zone_km: data.distance_to_dead_zone_km ?? old.distance_to_dead_zone_km ?? null,
            next_dead_zone: data.next_dead_zone ?? old.next_dead_zone ?? null,
            time_in_dead_zone_s: data.time_in_dead_zone_s ?? 0,
            dead_zone_progress_pct: data.dead_zone_progress_pct ?? 0,
            pre_arming_complete: data.pre_arming_complete ?? false,

            // Phase 8: Layer 6 — WebSocket
            ws_latency_ms: data.ws_latency_ms ?? old.ws_latency_ms ?? 94,
            ws_reconnecting: data.ws_reconnecting ?? false,
            ws_reconnect_attempt: data.ws_reconnect_attempt ?? 0,
            message_queue_depth: data.message_queue_depth ?? 0,
            ws_uptime_s: data.ws_uptime_s ?? old.ws_uptime_s ?? 0,
            missed_pings_session: data.missed_pings_session ?? old.missed_pings_session ?? 0,
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
