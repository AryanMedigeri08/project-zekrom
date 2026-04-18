/**
 * SimulationDashboard — What-If control panel (light mode, no emojis).
 *
 * Layout:
 *   Top:     ETA Timeline (compact, left) + Map View (right)
 *   Middle:  Scenario preset pills (small)
 *   Bottom:  Network | Environment | System blocks + Live Metrics + Log
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import MapView from './MapView';
import ETATimeline from './ETATimeline';

const API_BASE = 'http://localhost:8000';

// ── SVG Icons ──
const SignalIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546" />
  </svg>
);
const GlobeIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
  </svg>
);
const CogIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const InfoIcon = ({ className = 'w-3 h-3' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);
const FlaskIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
);
const ListIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

// ── Scenario presets ──
const SCENARIOS = [
  {
    id: 'rush_hour', title: 'Rush Hour', subtitle: 'Heavy traffic, strong signal',
    icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
    values: { signal_strength: 90, packet_loss: 5, latency_ms: 150, bus_speed_override: 25, traffic_level: 2, weather: 0, buffer_size_limit: 50 },
  },
  {
    id: 'dead_zone', title: 'Dead Zone', subtitle: 'Full signal loss',
    icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l8.735 8.735m0 0a.374.374 0 11.53.53m-.53-.53l.53.53m0 0L21 21M14.652 9.348a3.75 3.75 0 010 5.304m2.121-7.425a6.75 6.75 0 010 9.546m2.121-11.667c3.808 3.807 3.808 9.98 0 13.788m-9.546-4.242a3.733 3.733 0 01-1.06-2.122m-1.061 4.243a6.72 6.72 0 01-1.06-3.182" /></svg>,
    values: { signal_strength: 0, packet_loss: 50, latency_ms: 2000, bus_speed_override: 40, traffic_level: 0, weather: 0, buffer_size_limit: 50 },
  },
  {
    id: 'recovery', title: 'Recovery', subtitle: 'Dead → reconnect 5s',
    icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>,
    values: null,
  },
  {
    id: 'storm', title: 'Storm', subtitle: 'Rain + degraded',
    icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" /></svg>,
    values: { signal_strength: 35, packet_loss: 25, latency_ms: 800, bus_speed_override: 20, traffic_level: 2, weather: 2, buffer_size_limit: 50 },
  },
];

const DEAD_ZONE_VALUES = SCENARIOS[1].values;
const RECOVERY_VALUES = { signal_strength: 85, packet_loss: 5, latency_ms: 100, bus_speed_override: 40, traffic_level: 1, weather: 0, buffer_size_limit: 50 };

// ── Tooltip component ──
function Tooltip({ text }) {
  return (
    <span className="info-tooltip ml-1 cursor-help">
      <span className="text-gray-300 hover:text-gray-500 transition-colors"><InfoIcon /></span>
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════

export default function SimulationDashboard({ simConfig, etaData, route, busPosition, signalStrength, bufferedPings, clearBufferedPings }) {
  const { config, derived, dispatch, setAll, activeScenario, setActiveScenario } = simConfig;
  const [decisionLog, setDecisionLog] = useState([]);
  const [recoveryCountdown, setRecoveryCountdown] = useState(null);
  const recoveryTimerRef = useRef(null);

  // Poll system log
  useEffect(() => {
    const poll = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/system-log`);
        if (resp.ok) setDecisionLog(await resp.json());
      } catch { /* */ }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // Recovery animation
  const runRecovery = useCallback(() => {
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
        setAll(RECOVERY_VALUES, 'recovery');
      }
    }, 1000);
  }, [setAll]);

  useEffect(() => () => { if (recoveryTimerRef.current) clearInterval(recoveryTimerRef.current); }, []);

  const handleScenario = (s) => s.id === 'recovery' ? runRecovery() : setAll(s.values, s.id);

  // Derived
  const pingIntervalDisplay = derived?.ping_interval_ms ? `${derived.ping_interval_ms}ms` : 'Buffering';
  const pingsPerMin = derived?.pings_per_minute ?? 0;
  const payloadSize = derived?.payload_size_bytes ?? 0;
  const payloadMode = derived?.payload_mode ?? 'full';
  const bufferMode = derived?.buffer_mode ?? 'standby';
  const bufferRisk = derived?.buffer_risk ?? 'low';
  const confidenceWidth = derived?.confidence_width ?? 'narrow';

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">

      {/* ═══ Row 1: ETA Timeline (left) + Map (right) ═══ */}
      <div className="grid grid-cols-3 gap-3" style={{ minHeight: '220px' }}>
        {/* ETA compact */}
        <div className="col-span-1">
          <ETATimeline signalStrength={config.signal_strength} simConfig={simConfig} route={route} compact />
        </div>
        {/* Map */}
        <div className="col-span-2 rounded-xl overflow-hidden" style={{ minHeight: '220px' }}>
          <MapView route={route} busPosition={busPosition} signalStrength={signalStrength}
            bufferedPings={bufferedPings} clearBufferedPings={clearBufferedPings} compact />
        </div>
      </div>

      {/* ═══ Row 2: Scenario Presets (small pills) ═══ */}
      <div className="flex gap-2">
        {SCENARIOS.map((s) => (
          <button key={s.id} onClick={() => handleScenario(s)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-semibold transition-all
              ${activeScenario === s.id
                ? 'border-teal-400 bg-teal-50 text-teal-700 shadow-sm'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}>
            <span className={activeScenario === s.id ? 'text-teal-600' : 'text-gray-400'}>{s.icon}</span>
            <span>{s.title}</span>
            {s.id === 'recovery' && recoveryCountdown !== null && (
              <span className="ml-1 text-orange-600 font-extrabold animate-pulse">{recoveryCountdown}s</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ Row 3: Controls (3 blocks) + Metrics (1 block) ═══ */}
      <div className="grid grid-cols-4 gap-3 flex-1 min-h-0">

        {/* Block 1: Network Layer */}
        <ControlBlock icon={<SignalIcon className="w-3.5 h-3.5" />} title="Network Layer" color="text-teal-600">
          <SliderControl label="Signal Strength" value={config.signal_strength} min={0} max={100} unit="%"
            tooltip="Controls how often GPS pings are emitted. Below 10% enters dead zone."
            color={config.signal_strength >= 70 ? 'teal' : config.signal_strength >= 40 ? 'orange' : 'red'}
            onChange={(v) => dispatch('signal_strength', v)} />
          <SliderControl label="Packet Loss" value={config.packet_loss} min={0} max={50} unit="%"
            tooltip="Simulates network packet drops. Higher values increase effective ping interval."
            color={config.packet_loss > 25 ? 'red' : config.packet_loss > 10 ? 'orange' : 'teal'}
            onChange={(v) => dispatch('packet_loss', v)} />
          <SliderControl label="Latency" value={config.latency_ms} min={0} max={2000} step={50} unit="ms"
            tooltip="Transmission delay between bus GPS module and server."
            color={config.latency_ms > 1000 ? 'red' : config.latency_ms > 500 ? 'orange' : 'teal'}
            onChange={(v) => dispatch('latency_ms', v)} />
        </ControlBlock>

        {/* Block 2: Environment Layer */}
        <ControlBlock icon={<GlobeIcon className="w-3.5 h-3.5" />} title="Environment" color="text-blue-600">
          <SliderControl label="Bus Speed" value={config.bus_speed_override} min={10} max={80} unit="km/h"
            tooltip="Override the bus speed. Affects how fast the marker moves along the route."
            color="blue" onChange={(v) => dispatch('bus_speed_override', v)} />
          <ToggleControl label="Traffic" options={['Low', 'Medium', 'High']} value={config.traffic_level}
            tooltip="Affects ETA prediction. High traffic adds 5-12 min to predicted travel time."
            colors={['teal', 'orange', 'red']} onChange={(v) => dispatch('traffic_level', v)} />
          <ToggleControl label="Weather" options={['Clear', 'Cloudy', 'Rain']} value={config.weather}
            tooltip="Rain adds 5-15 min to ETA and widens the confidence cone."
            colors={['teal', 'blue', 'blue']} onChange={(v) => dispatch('weather', v)} />
        </ControlBlock>

        {/* Block 3: System Behavior */}
        <ControlBlock icon={<CogIcon className="w-3.5 h-3.5" />} title="System" color="text-purple-600">
          <SliderControl label="Buffer Capacity" value={config.buffer_size_limit} min={10} max={200} step={5} unit=" pings"
            tooltip="Max pings stored during signal loss. Exceeding this causes data loss."
            color="purple" onChange={(v) => dispatch('buffer_size_limit', v)} />
          <ToggleControl label="Interpolation" options={['Smooth', 'Literal']}
            value={config.interpolation_mode === 'smooth' ? 0 : 1}
            tooltip="Smooth: cubic ease between pings. Literal: jump to each new position."
            colors={['teal', 'orange']}
            onChange={(v) => dispatch('interpolation_mode', v === 0 ? 'smooth' : 'literal')} />
        </ControlBlock>

        {/* Block 4: Live Metrics + Log */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          {/* Ping Behavior */}
          <MiniCard title="Ping Behavior" items={[
            { label: 'Interval', value: pingIntervalDisplay },
            { label: 'Pings/min', value: `${pingsPerMin}` },
            { label: 'Payload', value: `${payloadSize}B (${payloadMode})` },
          ]} />
          {/* ETA Impact */}
          <MiniCard title="ETA Impact" items={[
            { label: 'Arrival', value: etaData?.predicted_arrival_time ?? '—' },
            { label: 'Confidence', value: `${etaData?.confidence_low ?? 0}–${etaData?.confidence_high ?? 0} min` },
            { label: 'Cone', value: confidenceWidth, badge: confidenceWidth === 'narrow' ? 'green' : confidenceWidth === 'medium' ? 'yellow' : 'red' },
          ]} />
          {/* Buffer */}
          <MiniCard title="Buffer Status" items={[
            { label: 'Mode', value: bufferMode === 'active' ? 'Active' : 'Standby', badge: bufferMode === 'active' ? 'red' : 'green' },
            { label: 'Stored', value: `${etaData?.buffer_count ?? 0}/${config.buffer_size_limit}` },
            { label: 'Risk', value: bufferRisk, badge: bufferRisk === 'low' ? 'green' : bufferRisk === 'medium' ? 'yellow' : 'red' },
          ]} />
          {/* Decision Log */}
          <div className="card-panel p-2.5 flex flex-col gap-1 flex-1 min-h-[120px]">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-gray-400"><ListIcon /></span>
              <span className="text-[9px] font-bold text-gray-500 tracking-wide">System Log</span>
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 pr-0.5">
              {decisionLog.length === 0 && (
                <span className="text-[9px] text-gray-300 italic">No events yet</span>
              )}
              {decisionLog.slice(-8).reverse().map((entry, i) => (
                <div key={i} className={`flex gap-1.5 text-[9px] leading-tight px-1.5 py-0.5 rounded ${
                  entry.level === 'critical' ? 'bg-red-50 text-red-600' :
                  entry.level === 'warn' ? 'bg-orange-50 text-orange-600' :
                  'bg-gray-50 text-gray-500'
                }`}>
                  <span className="font-mono text-gray-300 flex-shrink-0">{entry.timestamp}</span>
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

// ══════════════════════════════════════════════════════════════════
// Sub-Components
// ══════════════════════════════════════════════════════════════════

function ControlBlock({ icon, title, color, children }) {
  return (
    <div className="card-panel p-3 flex flex-col gap-2.5 overflow-y-auto">
      <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-100">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-bold text-gray-600 tracking-wide uppercase">{title}</span>
      </div>
      {children}
    </div>
  );
}

function SliderControl({ label, value, min, max, step = 1, unit, color, tooltip, onChange }) {
  const colorMap = {
    teal: 'text-teal-600', orange: 'text-orange-600', red: 'text-red-600',
    blue: 'text-blue-600', purple: 'text-purple-600',
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-[10px] text-gray-500 font-medium">{label}</span>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        <span className={`text-[10px] font-bold tabular-nums ${colorMap[color] || 'text-gray-600'}`}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function ToggleControl({ label, options, value, colors, tooltip, onChange }) {
  const colorStyles = {
    teal: 'border-teal-300 bg-teal-50 text-teal-700',
    orange: 'border-orange-300 bg-orange-50 text-orange-700',
    red: 'border-red-300 bg-red-50 text-red-700',
    blue: 'border-blue-300 bg-blue-50 text-blue-700',
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center">
        <span className="text-[10px] text-gray-500 font-medium">{label}</span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="flex gap-1">
        {options.map((opt, i) => (
          <button key={opt} onClick={() => onChange(i)}
            className={`flex-1 text-[9px] font-semibold py-1.5 rounded-md border transition-all ${
              value === i ? (colorStyles[colors[i]] || colorStyles.teal) : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniCard({ title, items }) {
  return (
    <div className="card-panel p-2.5 flex flex-col gap-1">
      <span className="text-[9px] font-bold text-gray-500 tracking-wide">{title}</span>
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-[9px] text-gray-400">{item.label}</span>
          <div className="flex items-center gap-1">
            {item.badge && (
              <span className={`w-1.5 h-1.5 rounded-full ${
                item.badge === 'green' ? 'bg-teal-500' : item.badge === 'yellow' ? 'bg-orange-500' : 'bg-red-500'
              }`} />
            )}
            <span className="text-[10px] font-semibold text-gray-700 tabular-nums">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
