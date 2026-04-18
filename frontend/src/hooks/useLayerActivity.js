/**
 * useLayerActivity.js — Phase 8: Computes active/idle state of all 6 resilience layers.
 *
 * Returns layer states derived from current bus telemetry + sim config.
 * When no bus is selected, automatically focuses on the most critical bus.
 */

import { useMemo, useRef } from 'react';

const FEATURE_IMPORTANCE = [
  { feature: 'traffic_level', weight: 0.31 },
  { feature: 'signal_strength', weight: 0.24 },
  { feature: 'departure_time', weight: 0.19 },
  { feature: 'weather', weight: 0.14 },
  { feature: 'passengers', weight: 0.12 },
];

const SCENARIO_CASCADES = {
  rush_hour: {
    label: 'Watch Layer 4 → 1',
    primary: [4, 1],
    description: 'ETA recalculates for traffic. Ping frequency adapts.',
  },
  dead_zone: {
    label: 'Watch Layer 5 → 3 → 2 → 1',
    primary: [5, 3, 2, 1],
    description: 'Pre-awareness fires. Ghost activates. Buffer engages. Payload compresses.',
  },
  recovery: {
    label: 'Watch Layer 2 → 3 → 4 → 6',
    primary: [2, 3, 4, 6],
    description: 'Buffer flushes. Ghost reconciles. ETA stabilizes. Connection resumes.',
  },
  storm: {
    label: 'Watch All Layers',
    primary: [1, 2, 3, 4, 5, 6],
    description: 'Full system stress. All layers engage simultaneously.',
  },
};

/**
 * Select the bus with highest "criticality" score.
 * Worst signal + most issues = highest priority.
 */
function getMostCriticalBus(buses) {
  let worst = null;
  let worstScore = -1;

  for (const [busId, bus] of Object.entries(buses)) {
    let score = 0;
    score += (100 - (bus.signal_strength ?? 85)); // lower signal = higher score
    if (bus.is_ghost) score += 50;
    if (bus.in_dead_zone) score += 30;
    if ((bus.buffer_size ?? 0) > 0) score += 20;
    if (bus.approaching_dead_zone) score += 15;
    if (score > worstScore) {
      worstScore = score;
      worst = busId;
    }
  }
  return worst;
}

function getPayloadMode(signal) {
  if (signal >= 70) return 'full';
  if (signal >= 40) return 'compressed';
  if (signal >= 10) return 'minimal';
  return 'ghost';
}

function getFieldsKept(signal) {
  if (signal >= 70) return 'All fields (full payload)';
  if (signal >= 40) return 'lat, lng, heading, speed, signal, timestamp';
  return 'lat, lng, heading, timestamp';
}

function getFieldsDropped(signal) {
  if (signal >= 70) return 'None';
  if (signal >= 40) return 'speed_history, passenger_count, route_metadata';
  return 'speed_history, passenger_count, route_metadata, stop_names, speed';
}

function getDataMode(bus) {
  if (bus.is_ghost) return 'historical';
  if ((bus.signal_strength ?? 85) < 40) return 'hybrid';
  return 'live';
}

export { SCENARIO_CASCADES, FEATURE_IMPORTANCE, getMostCriticalBus };

export default function useLayerActivity(buses, simConfig, selectedBusId, activeScenario) {
  const prevSignalRef = useRef({});
  const stableTimerRef = useRef({});

  const monitoredBusId = selectedBusId || getMostCriticalBus(buses || {});
  const bus = (buses || {})[monitoredBusId] || null;
  const config = simConfig?.config || {};
  const derived = simConfig?.derived || {};

  const layers = useMemo(() => {
    if (!bus) {
      return {
        layer1: { active: false, status: 'LOADING', data: {} },
        layer2: { active: false, status: 'LOADING', data: {} },
        layer3: { active: false, status: 'LOADING', data: {} },
        layer4: { active: false, status: 'LOADING', data: {} },
        layer5: { active: false, status: 'LOADING', data: {} },
        layer6: { active: false, status: 'LOADING', data: {} },
      };
    }

    const signal = bus.signal_strength ?? 85;
    const prevSignal = bus.prev_signal ?? signal;
    const signalDelta = Math.abs(signal - prevSignal);
    const packetLoss = config.packet_loss ?? 5;
    const latency = config.latency_ms ?? 100;
    const bufferCount = bus.buffer_count ?? bus.buffer_size ?? 0;
    const bufferMax = bus.buffer_max ?? config.buffer_size_limit ?? 50;

    // ── Layer 1: Adaptive Payload & Frequency ──
    const l1Active = signalDelta > 15 || packetLoss > 20 || latency > 500;
    const pingInterval = bus.ping_interval_ms ?? (signal >= 70 ? 2000 : signal >= 40 ? 6000 : signal >= 10 ? 12000 : 2000);
    const payloadSize = bus.payload_size_bytes ?? (signal >= 70 ? 400 : signal >= 40 ? 180 : signal >= 10 ? 64 : 38);
    const bandwidthSaved = bus.bandwidth_saved_pct ?? 0;

    const layer1 = {
      active: l1Active,
      status: l1Active ? 'ACTIVE' : 'NOMINAL',
      data: {
        pingInterval,
        prevPingInterval: prevSignal >= 70 ? 2000 : prevSignal >= 40 ? 6000 : 12000,
        payloadSize,
        prevPayloadSize: prevSignal >= 70 ? 400 : prevSignal >= 40 ? 180 : 64,
        bandwidthSaved,
        payloadMode: getPayloadMode(signal),
        fieldsKept: getFieldsKept(signal),
        fieldsDropped: getFieldsDropped(signal),
        signal,
        prevSignal,
        signalDelta,
        trend: signal < prevSignal ? 'degrading' : signal > prevSignal ? 'recovering' : 'stable',
        payloadHistory: bus.payload_history || [],
        bytesPerSecond: Math.round(payloadSize / (pingInterval / 1000)),
        packetsSent: bus.ping_count_session ?? 0,
        packetsDropped: bus.missed_pings_session ?? 0,
      },
    };

    // ── Layer 2: Store & Forward Buffer ──
    const l2Active = signal < 10 || bufferCount > 0 || bus.is_flushing;
    let l2Status = 'STANDBY';
    if (bus.is_flushing) l2Status = 'FLUSHING';
    else if (bufferCount > 0) l2Status = 'BUFFERING';

    const layer2 = {
      active: l2Active,
      status: l2Status,
      data: {
        bufferCount,
        bufferMax,
        fillPercent: bufferMax > 0 ? Math.round((bufferCount / bufferMax) * 100) : 0,
        isFlushing: bus.is_flushing ?? false,
        flushProgress: bus.flush_progress ?? 0,
        recentPings: bus.recent_buffered_pings || [],
        oldestPingAge: null, // computed client-side from timestamps
        newestPingAge: null,
      },
    };

    // ── Layer 3: Ghost Bus Extrapolation ──
    const l3Active = bus.is_ghost;
    let l3Status = 'INACTIVE';
    if (bus.reconciliation_deviation_m != null && !bus.is_ghost) l3Status = 'RECONCILING';
    else if (bus.is_ghost) l3Status = 'ACTIVE';

    const ghostElapsed = bus.ghost_start_time ? Math.round((Date.now() / 1000) - bus.ghost_start_time) : 0;

    const layer3 = {
      active: l3Active || l3Status === 'RECONCILING',
      status: l3Status,
      data: {
        timeSinceRealPing: ghostElapsed,
        lastSpeed: bus.last_real_speed ?? bus.speed_kmh ?? 0,
        lastHeading: bus.last_real_heading ?? bus.heading ?? 0,
        confidence: bus.ghost_confidence ?? 1.0,
        confidenceHistory: bus.ghost_confidence_history || [],
        distanceTraveled: bus.ghost_distance_traveled_km ?? 0,
        deviation: bus.reconciliation_deviation_m,
        deviationLabel: bus.reconciliation_deviation_m != null
          ? (bus.reconciliation_deviation_m < 50 ? 'Accurate' : bus.reconciliation_deviation_m < 150 ? 'Acceptable' : 'Significant drift')
          : null,
      },
    };

    // ── Layer 4: ML ETA Prediction Engine ──
    const l4Active = bus.eta_just_recalculated || bus.is_ghost;

    const layer4 = {
      active: l4Active,
      status: l4Active ? 'COMPUTING' : 'RUNNING',
      data: {
        dataMode: bus.eta_data_mode ?? getDataMode(bus),
        coneWidth: bus.eta_cone_width ?? 'narrow',
        confidence: bus.confidence_score ?? bus.eta_confidence ?? 0.8,
        featureImportance: FEATURE_IMPORTANCE,
        signal,
        trafficLevel: config.traffic_level ?? 1,
        weather: config.weather ?? 0,
      },
    };

    // ── Layer 5: Dead Zone Pre-awareness ──
    const l5Active = bus.approaching_dead_zone || bus.in_dead_zone;
    let l5Status = 'MONITORING';
    if (bus.in_dead_zone) l5Status = 'IN ZONE';
    else if (bus.approaching_dead_zone) l5Status = 'APPROACHING';

    const layer5 = {
      active: l5Active,
      status: l5Status,
      data: {
        nextZone: bus.next_dead_zone || null,
        distanceToZone: bus.distance_to_dead_zone_km,
        currentZone: bus.dead_zone || null,
        timeInZone: bus.time_in_dead_zone_s ?? 0,
        zoneProgress: bus.dead_zone_progress_pct ?? 0,
        preArmingComplete: bus.pre_arming_complete ?? false,
        inZone: bus.in_dead_zone ?? false,
        approaching: bus.approaching_dead_zone ?? false,
      },
    };

    // ── Layer 6: WebSocket Connection Resilience ──
    const wsLatency = bus.ws_latency_ms ?? latency;
    const l6Active = wsLatency > 200 || bus.ws_reconnecting;
    let l6Status = 'CONNECTED';
    if (bus.ws_reconnecting) l6Status = 'RECONNECTING';
    else if (wsLatency > 1000) l6Status = 'DEGRADED';
    else if (wsLatency > 200) l6Status = 'STRESSED';

    const layer6 = {
      active: l6Active,
      status: l6Status,
      data: {
        latency: wsLatency,
        baselineLatency: 94,
        degradationFactor: wsLatency > 94 ? +(wsLatency / 94).toFixed(1) : 1,
        reconnectAttempt: bus.ws_reconnect_attempt ?? 0,
        messageQueueDepth: bus.message_queue_depth ?? 0,
        uptime: bus.ws_uptime_s ?? 0,
        missedPings: bus.missed_pings_session ?? 0,
        reconnecting: bus.ws_reconnecting ?? false,
      },
    };

    return { layer1, layer2, layer3, layer4, layer5, layer6 };
  }, [bus, config]);

  // Cascade info
  const cascadeInfo = activeScenario ? SCENARIO_CASCADES[activeScenario] || null : null;

  return {
    ...layers,
    monitoredBusId,
    monitoredBus: bus,
    cascadeInfo,
    activeScenario,
  };
}
