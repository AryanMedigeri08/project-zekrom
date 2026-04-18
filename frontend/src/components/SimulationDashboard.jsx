/**
 * SimulationDashboard — Phase 3: Multi-bus What-If panel.
 *
 * Top:    Bus selector (All / MIT-01 / HIN-02 / HAD-03) + scenario pills
 * Middle: ETA compact (left) + Map (right)
 * Bottom: Network | Environment | System control blocks + metrics + log
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import MapView from './MapView';
import ETATimeline from './ETATimeline';

const API_BASE = 'http://localhost:8000';

// ── SVG Icons ──
const SignalIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546" />
  </svg>
);
const GlobeIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
  </svg>
);
const CogIcon = ({ className = 'w-3.5 h-3.5' }) => (
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
const ListIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

// ── Scenario icons ──
const RushIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
  </svg>
);
const DeadIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l8.735 8.735m0 0a.374.374 0 11.53.53m-.53-.53l.53.53m0 0L21 21" />
  </svg>
);
const RecoverIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
  </svg>
);
const StormIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
  </svg>
);

const SCENARIOS = [
  {
    id: 'rush_hour', title: 'Rush Hour', icon: <RushIcon />,
    values: { signal_strength: 90, packet_loss: 5, latency_ms: 150, traffic_level: 2, weather: 0, buffer_size_limit: 50 },
  },
  {
    id: 'dead_zone', title: 'Dead Zone', icon: <DeadIcon />,
    values: { signal_strength: 0, packet_loss: 50, latency_ms: 2000, traffic_level: 0, weather: 0, buffer_size_limit: 50 },
  },
  {
    id: 'recovery', title: 'Recovery', icon: <RecoverIcon />, values: null,
  },
  {
    id: 'storm', title: 'Storm', icon: <StormIcon />,
    values: { signal_strength: 35, packet_loss: 25, latency_ms: 800, traffic_level: 2, weather: 2, buffer_size_limit: 50 },
  },
];

const DEAD_VALUES = SCENARIOS[1].values;
const RECOVERY_VALUES = { signal_strength: 85, packet_loss: 5, latency_ms: 100, traffic_level: 1, weather: 0, buffer_size_limit: 50 };

// Tooltip sub-component
function TT({ text }) {
  return (
    <span className="info-tooltip ml-1 cursor-help">
      <span className="text-gray-300 hover:text-gray-500 transition-colors"><InfoIcon /></span>
      <span className="tooltip-text">{text}</span>
    </span>
  );
}

// Bus selector options
const BUS_OPTIONS = [
  { id: null, label: 'All Buses' },
  { id: 'bus_01', label: 'MIT-01' },
  { id: 'bus_02', label: 'HIN-02' },
  { id: 'bus_03', label: 'HAD-03' },
];

// ══════════════════════════════════════════════════════════════════
export default function SimulationDashboard({ simConfig, etaData, routes, buses, signalStrength, bufferedPings, clearBufferedPings }) {
  const { config, derived, dispatch, setAll, activeScenario, targetBusId, setTargetBusId } = simConfig;
  const [decisionLog, setDecisionLog] = useState([]);
  const [recoveryCountdown, setRecoveryCountdown] = useState(null);
  const recoveryTimerRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/system-log`);
        if (resp.ok) setDecisionLog(await resp.json());
      } catch { /* */ }
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, []);

  const runRecovery = useCallback(() => {
    setAll(DEAD_VALUES, 'recovery');
    setRecoveryCountdown(5);
    let c = 5;
    if (recoveryTimerRef.current) clearInterval(recoveryTimerRef.current);
    recoveryTimerRef.current = setInterval(() => {
      c -= 1;
      setRecoveryCountdown(c);
      if (c <= 0) {
        clearInterval(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
        setRecoveryCountdown(null);
        setAll(RECOVERY_VALUES, 'recovery');
      }
    }, 1000);
  }, [setAll]);

  useEffect(() => () => { if (recoveryTimerRef.current) clearInterval(recoveryTimerRef.current); }, []);

  const handleScenario = (s) => s.id === 'recovery' ? runRecovery() : setAll(s.values, s.id);

  const pingDisplay = derived?.ping_interval_ms ? `${derived.ping_interval_ms}ms` : 'Buffering';
  const confWidth = derived?.confidence_width ?? 'narrow';
  const bufRisk = derived?.buffer_risk ?? 'low';

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">

      {/* ═══ Row 0: Bus Selector + Scenario Pills ═══ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Bus selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-gray-400 tracking-wide mr-1">TARGET:</span>
          {BUS_OPTIONS.map((opt) => (
            <button key={opt.label} onClick={() => setTargetBusId(opt.id)}
              className={`px-2.5 py-1 rounded-md text-[9px] font-semibold border transition-all ${
                targetBusId === opt.id
                  ? 'border-teal-400 bg-teal-50 text-teal-700'
                  : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Scenario pills */}
        <div className="flex gap-1.5">
          {SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => handleScenario(s)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[9px] font-semibold transition-all ${
                activeScenario === s.id
                  ? 'border-teal-400 bg-teal-50 text-teal-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}>
              <span className={activeScenario === s.id ? 'text-teal-600' : 'text-gray-400'}>{s.icon}</span>
              {s.title}
              {s.id === 'recovery' && recoveryCountdown !== null && (
                <span className="ml-0.5 text-orange-600 font-extrabold animate-pulse">{recoveryCountdown}s</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Row 1: ETA (left) + Map (right) ═══ */}
      <div className="grid grid-cols-3 gap-3" style={{ minHeight: '200px' }}>
        <div className="col-span-1">
          <ETATimeline signalStrength={config.signal_strength} simConfig={simConfig} routes={routes} buses={buses} compact />
        </div>
        <div className="col-span-2 rounded-xl overflow-hidden" style={{ minHeight: '200px' }}>
          <MapView routes={routes} buses={buses} bufferedPings={bufferedPings} clearBufferedPings={clearBufferedPings} compact />
        </div>
      </div>

      {/* ═══ Row 2: Controls + Metrics ═══ */}
      <div className="grid grid-cols-4 gap-3 flex-1 min-h-0">

        {/* Network */}
        <ControlBlock icon={<SignalIcon />} title="Network" color="text-teal-600">
          <SliderCtrl label="Signal Strength" value={config.signal_strength} min={0} max={100} unit="%"
            tip="Controls ping frequency. <10% = dead zone." color={config.signal_strength >= 70 ? 'teal' : config.signal_strength >= 40 ? 'orange' : 'red'}
            onChange={(v) => dispatch('signal_strength', v)} />
          <SliderCtrl label="Packet Loss" value={config.packet_loss} min={0} max={50} unit="%"
            tip="Simulates dropped packets. Increases effective ping interval."
            color={config.packet_loss > 25 ? 'red' : config.packet_loss > 10 ? 'orange' : 'teal'}
            onChange={(v) => dispatch('packet_loss', v)} />
          <SliderCtrl label="Latency" value={config.latency_ms} min={0} max={2000} step={50} unit="ms"
            tip="Transmission delay between GPS module and server."
            color={config.latency_ms > 1000 ? 'red' : config.latency_ms > 500 ? 'orange' : 'teal'}
            onChange={(v) => dispatch('latency_ms', v)} />
        </ControlBlock>

        {/* Environment */}
        <ControlBlock icon={<GlobeIcon />} title="Environment" color="text-blue-600">
          <ToggleCtrl label="Traffic" options={['Low', 'Medium', 'High']} value={config.traffic_level}
            tip="Affects bus speed and route line color. High = red lines."
            colors={['teal', 'orange', 'red']} onChange={(v) => dispatch('traffic_level', v)} />
          <ToggleCtrl label="Weather" options={['Clear', 'Cloudy', 'Rain']} value={config.weather}
            tip="Rain adds 5-15 min to ETA and widens confidence cone."
            colors={['teal', 'blue', 'blue']} onChange={(v) => dispatch('weather', v)} />
        </ControlBlock>

        {/* System */}
        <ControlBlock icon={<CogIcon />} title="System" color="text-purple-600">
          <SliderCtrl label="Buffer Cap" value={config.buffer_size_limit} min={10} max={200} step={5} unit=" pings"
            tip="Max pings stored during dead zone. Exceeding = data loss."
            color="purple" onChange={(v) => dispatch('buffer_size_limit', v)} />
          <ToggleCtrl label="Interpolation" options={['Smooth', 'Literal']}
            value={config.interpolation_mode === 'smooth' ? 0 : 1}
            tip="Smooth: cubic ease. Literal: jump to each new position."
            colors={['teal', 'orange']}
            onChange={(v) => dispatch('interpolation_mode', v === 0 ? 'smooth' : 'literal')} />
        </ControlBlock>

        {/* Metrics + Log */}
        <div className="flex flex-col gap-2 overflow-y-auto">
          <MCard title="Ping" items={[
            { l: 'Interval', v: pingDisplay },
            { l: 'Pings/min', v: `${derived?.pings_per_minute ?? 0}` },
            { l: 'Payload', v: `${derived?.payload_size_bytes ?? 0}B` },
          ]} />
          <MCard title="ETA Impact" items={[
            { l: 'Arrival', v: etaData?.predicted_arrival_time ?? '—' },
            { l: 'Confidence', v: confWidth, badge: confWidth === 'narrow' ? 'g' : confWidth === 'medium' ? 'y' : 'r' },
            { l: 'Penalty', v: etaData?.signal_penalty_applied ? 'Yes' : 'No', badge: etaData?.signal_penalty_applied ? 'r' : 'g' },
          ]} />
          <MCard title="Buffer" items={[
            { l: 'Mode', v: derived?.buffer_mode === 'active' ? 'Active' : 'Standby', badge: derived?.buffer_mode === 'active' ? 'r' : 'g' },
            { l: 'Risk', v: bufRisk, badge: bufRisk === 'low' ? 'g' : bufRisk === 'medium' ? 'y' : 'r' },
          ]} />
          {/* Log */}
          <div className="card-panel p-2.5 flex flex-col gap-1 flex-1 min-h-[100px]">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-gray-400"><ListIcon /></span>
              <span className="text-[9px] font-bold text-gray-500">System Log</span>
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto flex-1">
              {decisionLog.length === 0 && <span className="text-[9px] text-gray-300 italic">No events</span>}
              {decisionLog.slice(-10).reverse().map((e, i) => (
                <div key={i} className={`flex gap-1.5 text-[9px] leading-tight px-1.5 py-0.5 rounded ${
                  e.level === 'critical' ? 'bg-red-50 text-red-600' :
                  e.level === 'warn' ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-500'
                }`}>
                  <span className="font-mono text-gray-300 flex-shrink-0">{e.timestamp}</span>
                  <span className="truncate">{e.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════ Sub-components ══════

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

function SliderCtrl({ label, value, min, max, step = 1, unit, color, tip, onChange }) {
  const cm = { teal: 'text-teal-600', orange: 'text-orange-600', red: 'text-red-600', blue: 'text-blue-600', purple: 'text-purple-600' };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-[10px] text-gray-500 font-medium">{label}</span>
          {tip && <TT text={tip} />}
        </div>
        <span className={`text-[10px] font-bold tabular-nums ${cm[color] || 'text-gray-600'}`}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

function ToggleCtrl({ label, options, value, colors, tip, onChange }) {
  const cs = { teal: 'border-teal-300 bg-teal-50 text-teal-700', orange: 'border-orange-300 bg-orange-50 text-orange-700', red: 'border-red-300 bg-red-50 text-red-700', blue: 'border-blue-300 bg-blue-50 text-blue-700' };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center">
        <span className="text-[10px] text-gray-500 font-medium">{label}</span>
        {tip && <TT text={tip} />}
      </div>
      <div className="flex gap-1">
        {options.map((opt, i) => (
          <button key={opt} onClick={() => onChange(i)}
            className={`flex-1 text-[9px] font-semibold py-1.5 rounded-md border transition-all ${
              value === i ? (cs[colors[i]] || cs.teal) : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600'
            }`}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

function MCard({ title, items }) {
  return (
    <div className="card-panel p-2.5 flex flex-col gap-1">
      <span className="text-[9px] font-bold text-gray-500">{title}</span>
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between">
          <span className="text-[9px] text-gray-400">{it.l}</span>
          <div className="flex items-center gap-1">
            {it.badge && <span className={`w-1.5 h-1.5 rounded-full ${it.badge === 'g' ? 'bg-teal-500' : it.badge === 'y' ? 'bg-orange-500' : 'bg-red-500'}`} />}
            <span className="text-[10px] font-semibold text-gray-700">{it.v}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
