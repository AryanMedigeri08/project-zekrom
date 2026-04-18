/**
 * SimulationDashboard — What-If control panel for live demo interaction.
 *
 * Layout: Two columns.
 *   Left  — Parameter sliders/toggles (Network, Environment, System)
 *   Right — Live reaction metrics (Ping, ETA, Buffer, Decision Log)
 *
 * Top row: four preset scenario cards.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'http://localhost:8000';

// ═══════════════════════════════════════════════════════════════════════════
// Preset Scenarios
// ═══════════════════════════════════════════════════════════════════════════

const SCENARIOS = [
  {
    id: 'rush_hour',
    icon: '🚦',
    title: 'Rush Hour',
    subtitle: 'Heavy traffic, strong signal',
    values: {
      signal_strength: 90, packet_loss: 5, latency_ms: 150,
      bus_speed_override: 25, traffic_level: 2, weather: 0,
      buffer_size_limit: 50,
    },
  },
  {
    id: 'dead_zone',
    icon: '📡',
    title: 'Dead Zone',
    subtitle: 'Complete signal loss',
    values: {
      signal_strength: 0, packet_loss: 50, latency_ms: 2000,
      bus_speed_override: 40, traffic_level: 0, weather: 0,
      buffer_size_limit: 50,
    },
  },
  {
    id: 'recovery',
    icon: '🔄',
    title: 'Recovery',
    subtitle: 'Dead → reconnect in 5s',
    values: null, // special animated scenario
  },
  {
    id: 'storm',
    icon: '⛈️',
    title: 'Storm Conditions',
    subtitle: 'Rain, degraded signal',
    values: {
      signal_strength: 35, packet_loss: 25, latency_ms: 800,
      bus_speed_override: 20, traffic_level: 2, weather: 2,
      buffer_size_limit: 50,
    },
  },
];

const DEAD_ZONE_VALUES = {
  signal_strength: 0, packet_loss: 50, latency_ms: 2000,
  bus_speed_override: 40, traffic_level: 0, weather: 0,
  buffer_size_limit: 50,
};
const RECOVERY_VALUES = {
  signal_strength: 85, packet_loss: 5, latency_ms: 100,
  bus_speed_override: 40, traffic_level: 1, weather: 0,
  buffer_size_limit: 50,
};

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function SimulationDashboard({ simConfig, etaData }) {
  const { config, derived, dispatch, setAll, activeScenario, setActiveScenario } = simConfig;

  // Decision log polling
  const [decisionLog, setDecisionLog] = useState([]);
  const [recoveryCountdown, setRecoveryCountdown] = useState(null);
  const recoveryTimerRef = useRef(null);

  // Poll system-log every 2 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/system-log`);
        if (resp.ok) setDecisionLog(await resp.json());
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // ── Recovery scenario animation ──
  const runRecoveryScenario = useCallback(() => {
    // Step 1: Apply dead zone
    setAll(DEAD_ZONE_VALUES, 'recovery');
    setRecoveryCountdown(5);

    let count = 5;
    if (recoveryTimerRef.current) clearInterval(recoveryTimerRef.current);

    recoveryTimerRef.current = setInterval(() => {
      count -= 1;
      setRecoveryCountdown(count);

      if (count <= 0) {
        clearInterval(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
        setRecoveryCountdown(null);
        // Step 2: Restore to normal
        setAll(RECOVERY_VALUES, 'recovery');
      }
    }, 1000);
  }, [setAll]);

  // Cleanup recovery timer on unmount
  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current) clearInterval(recoveryTimerRef.current);
    };
  }, []);

  // ── Scenario click handler ──
  const handleScenario = (scenario) => {
    if (scenario.id === 'recovery') {
      runRecoveryScenario();
    } else {
      setAll(scenario.values, scenario.id);
    }
  };

  // ── Derived display helpers ──
  const pingIntervalDisplay = derived?.ping_interval_ms
    ? `${derived.ping_interval_ms}ms`
    : 'Buffering';
  const pingsPerMin = derived?.pings_per_minute ?? 0;
  const payloadSize = derived?.payload_size_bytes ?? 0;
  const payloadMode = derived?.payload_mode ?? 'full';
  const bufferMode = derived?.buffer_mode ?? 'standby';
  const bufferRisk = derived?.buffer_risk ?? 'low';
  const confidenceWidth = derived?.confidence_width ?? 'narrow';

  return (
    <div className="glass-panel p-4 flex flex-col gap-4 h-full overflow-y-auto">
      {/* ── Title ── */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        </div>
        <h2 className="text-sm font-bold text-gray-100 tracking-wide">What-If Simulation</h2>
      </div>

      {/* ═══ Scenario Presets ═══ */}
      <div className="grid grid-cols-4 gap-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => handleScenario(s)}
            className={`relative flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all duration-300 cursor-pointer
              ${activeScenario === s.id
                ? 'border-accent-cyan/60 bg-accent-cyan/10 shadow-[0_0_12px_rgba(6,214,160,0.15)]'
                : 'border-surface-600/40 bg-surface-800/40 hover:border-surface-600 hover:bg-surface-800/70'
              }`}
          >
            <span className="text-xl">{s.icon}</span>
            <span className="text-[10px] font-bold text-gray-200 leading-tight text-center">{s.title}</span>
            <span className="text-[8px] text-gray-500 leading-tight text-center">{s.subtitle}</span>
            {/* Recovery countdown overlay */}
            {s.id === 'recovery' && recoveryCountdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-950/80 rounded-lg">
                <span className="text-accent-orange font-extrabold text-lg animate-pulse">
                  {recoveryCountdown}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* ═══ Two-Column Layout ═══ */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">

        {/* ── LEFT: Parameter Controls ── */}
        <div className="flex flex-col gap-3 overflow-y-auto pr-1">

          {/* Section 1: Network Layer */}
          <SectionHeader icon="📶" title="Network Layer" />
          <SliderControl
            label="Signal Strength"
            value={config.signal_strength}
            min={0} max={100} step={1}
            unit="%"
            color={config.signal_strength >= 70 ? 'cyan' : config.signal_strength >= 40 ? 'orange' : 'red'}
            onChange={(v) => dispatch('signal_strength', v)}
          />
          <SliderControl
            label="Packet Loss Rate"
            value={config.packet_loss}
            min={0} max={50} step={1}
            unit="%"
            color={config.packet_loss > 25 ? 'red' : config.packet_loss > 10 ? 'orange' : 'cyan'}
            onChange={(v) => dispatch('packet_loss', v)}
          />
          <SliderControl
            label="Transmission Latency"
            value={config.latency_ms}
            min={0} max={2000} step={50}
            unit="ms"
            color={config.latency_ms > 1000 ? 'red' : config.latency_ms > 500 ? 'orange' : 'cyan'}
            onChange={(v) => dispatch('latency_ms', v)}
          />

          {/* Section 2: Environment Layer */}
          <SectionHeader icon="🌍" title="Environment Layer" />
          <SliderControl
            label="Bus Speed"
            value={config.bus_speed_override}
            min={10} max={80} step={1}
            unit="km/h"
            color="blue"
            onChange={(v) => dispatch('bus_speed_override', v)}
          />
          <ToggleControl
            label="Traffic Condition"
            options={['Low', 'Medium', 'High']}
            value={config.traffic_level}
            colors={['cyan', 'orange', 'red']}
            onChange={(v) => dispatch('traffic_level', v)}
          />
          <ToggleControl
            label="Weather"
            options={['Clear', 'Cloudy', 'Rain']}
            value={config.weather}
            colors={['cyan', 'orange', 'blue']}
            onChange={(v) => dispatch('weather', v)}
          />

          {/* Section 3: System Behavior */}
          <SectionHeader icon="⚙️" title="System Behavior" />
          <SliderControl
            label="Offline Buffer Capacity"
            value={config.buffer_size_limit}
            min={10} max={200} step={5}
            unit=" pings"
            color="purple"
            onChange={(v) => dispatch('buffer_size_limit', v)}
          />
          <ToggleControl
            label="Path Interpolation Mode"
            options={['Smooth', 'Literal']}
            value={config.interpolation_mode === 'smooth' ? 0 : 1}
            colors={['cyan', 'orange']}
            onChange={(v) => dispatch('interpolation_mode', v === 0 ? 'smooth' : 'literal')}
          />
        </div>

        {/* ── RIGHT: Live Reaction Metrics ── */}
        <div className="flex flex-col gap-3 overflow-y-auto pl-1">

          {/* Card 1: Ping Behavior */}
          <MetricCard title="🏓 Ping Behavior" items={[
            { label: 'Current ping interval', value: pingIntervalDisplay },
            { label: 'Expected pings/min', value: `${pingsPerMin}` },
            { label: 'Payload size', value: `${payloadSize} B (${payloadMode})` },
          ]} />

          {/* Card 2: ETA Impact */}
          <MetricCard title="🎯 ETA Impact" items={[
            {
              label: 'Predicted arrival',
              value: etaData?.predicted_arrival_time ?? '—',
            },
            {
              label: 'Confidence range',
              value: etaData
                ? `${etaData.confidence_low}–${etaData.confidence_high} min`
                : '—',
            },
            {
              label: 'Cone width',
              value: confidenceWidth.charAt(0).toUpperCase() + confidenceWidth.slice(1),
              badge: confidenceWidth === 'narrow' ? 'green' : confidenceWidth === 'medium' ? 'yellow' : 'red',
            },
            {
              label: 'Signal penalty',
              value: etaData?.signal_penalty_applied ? 'Yes' : 'No',
              badge: etaData?.signal_penalty_applied ? 'red' : 'green',
            },
          ]} />

          {/* Card 3: Buffer Status */}
          <MetricCard title="📦 Buffer Status" items={[
            {
              label: 'Buffer mode',
              value: bufferMode === 'active' ? 'Active' : 'Standby',
              badge: bufferMode === 'active' ? 'red' : 'green',
            },
            {
              label: 'Pings stored',
              value: `${etaData?.buffer_count ?? 0} / ${config.buffer_size_limit}`,
            },
            {
              label: 'Data loss risk',
              value: bufferRisk.charAt(0).toUpperCase() + bufferRisk.slice(1),
              badge: bufferRisk === 'low' ? 'green' : bufferRisk === 'medium' ? 'yellow' : 'red',
            },
          ]} />

          {/* Card 4: System Decision Log */}
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-surface-800/40 border border-surface-600/30">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs">📋</span>
              <span className="text-[10px] font-bold text-gray-300 tracking-wide">System Decisions</span>
            </div>
            <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1">
              {decisionLog.length === 0 && (
                <span className="text-[10px] text-gray-600 italic">No events yet…</span>
              )}
              {decisionLog.slice(-8).reverse().map((entry, i) => (
                <div
                  key={i}
                  className={`flex gap-2 text-[10px] leading-tight px-2 py-1 rounded ${
                    entry.level === 'critical'
                      ? 'bg-accent-red/10 text-accent-red/90'
                      : entry.level === 'warn'
                      ? 'bg-accent-orange/10 text-accent-orange/90'
                      : 'bg-surface-700/30 text-gray-400'
                  }`}
                >
                  <span className="font-mono text-gray-600 flex-shrink-0">{entry.timestamp}</span>
                  <span>{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-xs">{icon}</span>
      <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">{title}</span>
      <div className="flex-1 h-px bg-surface-600/30" />
    </div>
  );
}

function SliderControl({ label, value, min, max, step, unit, color, onChange }) {
  const colorMap = {
    cyan: 'from-accent-cyan/20 to-accent-cyan/50',
    orange: 'from-accent-orange/20 to-accent-orange/50',
    red: 'from-accent-red/20 to-accent-red/50',
    blue: 'from-accent-blue/20 to-accent-blue/50',
    purple: 'from-accent-purple/20 to-accent-purple/50',
  };
  const textColorMap = {
    cyan: 'text-accent-cyan',
    orange: 'text-accent-orange',
    red: 'text-accent-red',
    blue: 'text-accent-blue',
    purple: 'text-accent-purple',
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-medium">{label}</span>
        <span className={`text-[11px] font-bold tabular-nums ${textColorMap[color] || 'text-gray-300'}`}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-1.5 rounded-full cursor-pointer bg-gradient-to-r ${colorMap[color] || colorMap.cyan}`}
      />
    </div>
  );
}

function ToggleControl({ label, options, value, colors, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-gray-400 font-medium">{label}</span>
      <div className="flex gap-1">
        {options.map((opt, i) => {
          const isActive = value === i;
          const colorMap = {
            cyan: 'border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyan',
            orange: 'border-accent-orange/50 bg-accent-orange/15 text-accent-orange',
            red: 'border-accent-red/50 bg-accent-red/15 text-accent-red',
            blue: 'border-accent-blue/50 bg-accent-blue/15 text-accent-blue',
          };
          return (
            <button
              key={opt}
              onClick={() => onChange(i)}
              className={`flex-1 text-[9px] font-bold py-1.5 rounded-md border transition-all duration-200
                ${isActive
                  ? colorMap[colors[i]] || colorMap.cyan
                  : 'border-surface-600/30 bg-surface-800/30 text-gray-500 hover:text-gray-300'
                }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ title, items }) {
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-surface-800/40 border border-surface-600/30">
      <span className="text-[10px] font-bold text-gray-300 tracking-wide mb-0.5">{title}</span>
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500">{item.label}</span>
          <div className="flex items-center gap-1.5">
            {item.badge && (
              <span className={`w-1.5 h-1.5 rounded-full ${
                item.badge === 'green' ? 'bg-accent-cyan' :
                item.badge === 'yellow' ? 'bg-accent-orange' : 'bg-accent-red'
              }`} />
            )}
            <span className="text-[11px] font-semibold text-gray-200 tabular-nums">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
