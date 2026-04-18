/**
 * useSimConfig — Multi-bus simulation config with bus_id targeting.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

const API_BASE = 'http://localhost:8000';

const DEFAULT_CONFIG = {
  signal_strength: 85,
  packet_loss: 5,
  latency_ms: 100,
  bus_speed_override: 0,
  traffic_level: 1,
  weather: 0,
  buffer_size_limit: 50,
  interpolation_mode: 'smooth',
};

export default function useSimConfig() {
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [targetBusId, setTargetBusId] = useState(null); // null = all buses
  const [activeScenario, setActiveScenario] = useState(null);
  const debounceTimer = useRef(null);

  // Derived values (local computation)
  const derived = useMemo(() => {
    const sig = config.signal_strength;
    let baseInterval = null;
    if (sig >= 70) baseInterval = 2;
    else if (sig >= 40) baseInterval = 6;
    else if (sig >= 10) baseInterval = 12;
    const lossFactor = 1.0 + (config.packet_loss / 100) * 0.5;
    const effectiveInterval = baseInterval ? baseInterval * lossFactor : null;
    const payloadSize = sig >= 70 ? 256 : sig >= 40 ? 128 : 64;
    const payloadMode = sig >= 70 ? 'full' : sig >= 40 ? 'compressed' : 'minimal';
    const confidenceWidth = sig >= 70 ? 'narrow' : sig >= 40 ? 'medium' : 'wide';
    let bufferRisk = 'low';
    if (sig < 10) bufferRisk = 'high';
    else if (sig < 40 || config.packet_loss > 25) bufferRisk = 'medium';

    return {
      ping_interval_ms: effectiveInterval ? Math.round(effectiveInterval * 1000) : null,
      pings_per_minute: effectiveInterval ? +(60 / effectiveInterval).toFixed(1) : 0,
      payload_size_bytes: payloadSize,
      payload_mode: payloadMode,
      buffer_risk: bufferRisk,
      buffer_mode: sig < 10 ? 'active' : 'standby',
      confidence_width: confidenceWidth,
    };
  }, [config]);

  const pushToBackend = useCallback(async (newConfig, busId = null) => {
    try {
      const body = { ...newConfig };
      if (busId) body.bus_id = busId;
      await fetch(`${API_BASE}/api/sim-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn('[Zekrom] SimConfig push failed:', err);
    }
  }, []);

  const dispatch = useCallback((key, value) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => pushToBackend(next, targetBusId), 300);
      return next;
    });
    setActiveScenario(null);
  }, [pushToBackend, targetBusId]);

  const setAll = useCallback((values, scenarioName = null) => {
    const next = { ...DEFAULT_CONFIG, ...values };
    setConfig(next);
    setActiveScenario(scenarioName);
    clearTimeout(debounceTimer.current);
    pushToBackend(next, targetBusId);
  }, [pushToBackend, targetBusId]);

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  return {
    config,
    derived,
    dispatch,
    setAll,
    activeScenario,
    setActiveScenario,
    targetBusId,
    setTargetBusId,
  };
}
