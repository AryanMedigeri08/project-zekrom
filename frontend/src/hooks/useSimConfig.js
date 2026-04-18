/**
 * useSimConfig — Centralized state management for the What-If Simulation Dashboard.
 *
 * Holds all slider/toggle values in a single state object, computes derived values
 * (ping interval, payload size, cone width, buffer risk), and pushes config changes
 * to the backend via POST /api/sim-config with 300ms debounce.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

const API_BASE = 'http://localhost:8000';

// Default simulation configuration matching backend SimConfig defaults
const DEFAULT_CONFIG = {
  signal_strength: 85,
  packet_loss: 5,
  latency_ms: 100,
  bus_speed_override: 40,
  traffic_level: 1,  // 0=low, 1=medium, 2=high
  weather: 0,        // 0=clear, 1=cloudy, 2=rain
  buffer_size_limit: 50,
  interpolation_mode: 'smooth', // "smooth" | "literal"
};

export default function useSimConfig() {
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG });
  const [derivedValues, setDerivedValues] = useState(null);
  const [activeScenario, setActiveScenario] = useState(null);
  const debounceTimer = useRef(null);

  // ---------------------------------------------------------------
  // Compute derived values locally (mirror of backend logic)
  // ---------------------------------------------------------------
  const localDerived = useMemo(() => {
    const sig = config.signal_strength;

    // Ping interval
    let baseInterval = null;
    if (sig >= 70) baseInterval = 2;
    else if (sig >= 40) baseInterval = 6;
    else if (sig >= 10) baseInterval = 12;
    const lossFactor = 1.0 + (config.packet_loss / 100) * 0.5;
    const effectiveInterval = baseInterval ? baseInterval * lossFactor : null;

    // Payload
    const payloadSize = sig >= 70 ? 256 : sig >= 40 ? 128 : 64;
    const payloadMode = sig >= 70 ? 'full' : sig >= 40 ? 'compressed' : 'minimal';

    // Confidence
    const confidenceWidth = sig >= 70 ? 'narrow' : sig >= 40 ? 'medium' : 'wide';

    // Buffer risk
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

  // Use server-derived values if available, otherwise local
  const derived = derivedValues || localDerived;

  // ---------------------------------------------------------------
  // Push config to backend (debounced 300ms)
  // ---------------------------------------------------------------
  const pushToBackend = useCallback(async (newConfig) => {
    try {
      const resp = await fetch(`${API_BASE}/api/sim-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.derived) setDerivedValues(data.derived);
      }
    } catch (err) {
      console.warn('[SimConfig] Failed to push config:', err);
    }
  }, []);

  // ---------------------------------------------------------------
  // Dispatch — update a single config key
  // ---------------------------------------------------------------
  const dispatch = useCallback(
    (key, value) => {
      setConfig((prev) => {
        const next = { ...prev, [key]: value };
        // Debounce backend push
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => pushToBackend(next), 300);
        return next;
      });
      // Any manual slider move clears the active scenario highlight
      setActiveScenario(null);
    },
    [pushToBackend]
  );

  // ---------------------------------------------------------------
  // Bulk set — apply all values at once (for scenario presets)
  // ---------------------------------------------------------------
  const setAll = useCallback(
    (values, scenarioName = null) => {
      const next = { ...DEFAULT_CONFIG, ...values };
      setConfig(next);
      setActiveScenario(scenarioName);
      // Push immediately for scenarios (no debounce)
      clearTimeout(debounceTimer.current);
      pushToBackend(next);
    },
    [pushToBackend]
  );

  // ---------------------------------------------------------------
  // Cleanup debounce timer on unmount
  // ---------------------------------------------------------------
  useEffect(() => {
    return () => clearTimeout(debounceTimer.current);
  }, []);

  return {
    config,
    derived,
    dispatch,
    setAll,
    activeScenario,
    setActiveScenario,
  };
}
