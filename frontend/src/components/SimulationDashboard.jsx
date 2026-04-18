/**
 * SimulationDashboard.jsx — Phase 6: Full map parity, 70:30 layout, sim badge.
 *
 * Layout: Map (70%) + Controls (30%) on top, ETA + AI Decisions below.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import MapView from './MapView';
import ETATimeline from './ETATimeline';
import AIDecisionLog from './AIDecisionLog';
import { useTheme } from '../context/ThemeContext';

const API_BASE = 'http://localhost:8000';

const SCENARIOS = [
  { id: 'rush_hour', title: 'Rush Hour', values: { signal_strength: 90, packet_loss: 5, latency_ms: 150, traffic_level: 2, weather: 0, buffer_size_limit: 50 } },
  { id: 'dead_zone', title: 'Dead Zone', values: { signal_strength: 0, packet_loss: 50, latency_ms: 2000, traffic_level: 0, weather: 0, buffer_size_limit: 50 } },
  { id: 'recovery', title: 'Recovery', values: null },
  { id: 'storm', title: 'Storm', values: { signal_strength: 35, packet_loss: 25, latency_ms: 800, traffic_level: 2, weather: 2, buffer_size_limit: 50 } },
];

const DEAD_VALUES = SCENARIOS[1].values;
const RECOVERY_VALUES = { signal_strength: 85, packet_loss: 5, latency_ms: 100, traffic_level: 1, weather: 0, buffer_size_limit: 50 };

const BUS_OPTIONS = [
  { id: null, label: 'All Buses' },
  { id: 'bus_01', label: 'MIT-01' },
  { id: 'bus_02', label: 'HIN-02' },
  { id: 'bus_03', label: 'HAD-03' },
  { id: 'bus_04', label: 'KAT-04' },
  { id: 'bus_05', label: 'PUN-05' },
];

export default function SimulationDashboard({ simConfig, routes, buses, deadZones, mitaoe }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { config, derived, dispatch, setAll, activeScenario, targetBusId, setTargetBusId } = simConfig;
  const [recoveryCountdown, setRecoveryCountdown] = useState(null);
  const recoveryTimerRef = useRef(null);

  const runRecovery = useCallback(() => {
    setAll(DEAD_VALUES, 'recovery');
    setRecoveryCountdown(5);
    let c = 5;
    if (recoveryTimerRef.current) clearInterval(recoveryTimerRef.current);
    recoveryTimerRef.current = setInterval(() => {
      c -= 1; setRecoveryCountdown(c);
      if (c <= 0) { clearInterval(recoveryTimerRef.current); recoveryTimerRef.current = null; setRecoveryCountdown(null); setAll(RECOVERY_VALUES, 'recovery'); }
    }, 1000);
  }, [setAll]);

  useEffect(() => () => { if (recoveryTimerRef.current) clearInterval(recoveryTimerRef.current); }, []);
  const handleScenario = (s) => s.id === 'recovery' ? runRecovery() : setAll(s.values, s.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>

      {/* Row 0: Bus Selector + Scenarios */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '1px' }}>TARGET:</span>
          {BUS_OPTIONS.map(opt => (
            <button key={opt.label} onClick={() => setTargetBusId(opt.id)} style={{
              padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              border: `1px solid ${targetBusId === opt.id ? '#14b8a6' : 'var(--color-border)'}`,
              background: targetBusId === opt.id ? (isDark ? '#0d3331' : '#f0fdfa') : 'var(--color-bg-card)',
              color: targetBusId === opt.id ? '#14b8a6' : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}>{opt.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => handleScenario(s)} style={{
              padding: '4px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              border: `1px solid ${activeScenario === s.id ? '#14b8a6' : 'var(--color-border)'}`,
              background: activeScenario === s.id ? (isDark ? '#0d3331' : '#f0fdfa') : 'var(--color-bg-card)',
              color: activeScenario === s.id ? '#14b8a6' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}>
              {s.title}
              {s.id === 'recovery' && recoveryCountdown !== null && (
                <span style={{ marginLeft: '4px', color: '#f97316', fontWeight: 800, animation: 'signal-blink 0.8s infinite' }}>{recoveryCountdown}s</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Map (70%) + Controls (30%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '12px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Simulation Map */}
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
          {/* Simulation badge */}
          <div style={{
            position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', zIndex: 500,
            background: 'rgba(245,158,11,0.9)', color: '#1e293b', fontSize: '13px', fontWeight: 700,
            padding: '4px 14px', borderRadius: '6px', backdropFilter: 'blur(4px)',
          }}>
            SIMULATION MODE — Parameters Override Active
          </div>

          {/* Parameter readout overlay */}
          <div style={{
            position: 'absolute', bottom: '12px', right: '12px', zIndex: 500,
            background: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)', borderRadius: '8px', padding: '8px 12px',
            border: '1px solid var(--color-border)', fontSize: '13px', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px', fontSize: '12px', letterSpacing: '0.5px' }}>Active Parameters</div>
            <div style={{ color: 'var(--color-text-secondary)' }}>Signal: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{config.signal_strength}%</span></div>
            <div style={{ color: 'var(--color-text-secondary)' }}>Traffic: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{['Low', 'Medium', 'High'][config.traffic_level]}</span></div>
            <div style={{ color: 'var(--color-text-secondary)' }}>Latency: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{config.latency_ms}ms</span></div>
            <div style={{ color: 'var(--color-text-secondary)' }}>Packet Loss: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{config.packet_loss}%</span></div>
          </div>

          <MapView
            routes={routes}
            buses={buses}
            deadZones={deadZones}
            mitaoe={mitaoe}
            mapId="sim-map"
            compact={false}
            showLegend={true}
          />
        </div>

        {/* Control Panel */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <ControlBlock title="Network" icon="">
            <SliderCtrl label="Signal Strength" value={config.signal_strength} min={0} max={100} unit="%" color={config.signal_strength >= 70 ? '#14b8a6' : config.signal_strength >= 40 ? '#f97316' : '#ef4444'} onChange={v => dispatch('signal_strength', v)} />
            <SliderCtrl label="Packet Loss" value={config.packet_loss} min={0} max={50} unit="%" color={config.packet_loss > 25 ? '#ef4444' : '#14b8a6'} onChange={v => dispatch('packet_loss', v)} />
            <SliderCtrl label="Latency" value={config.latency_ms} min={0} max={2000} step={50} unit="ms" color={config.latency_ms > 1000 ? '#ef4444' : '#14b8a6'} onChange={v => dispatch('latency_ms', v)} />
          </ControlBlock>

          <ControlBlock title="Environment" icon="">
            <ToggleCtrl label="Traffic" options={['Low', 'Medium', 'High']} value={config.traffic_level} colors={['#14b8a6', '#f97316', '#ef4444']} onChange={v => dispatch('traffic_level', v)} />
            <ToggleCtrl label="Weather" options={['Clear', 'Cloudy', 'Rain']} value={config.weather} colors={['#14b8a6', '#3b82f6', '#3b82f6']} onChange={v => dispatch('weather', v)} />
          </ControlBlock>

          <ControlBlock title="System" icon="">
            <SliderCtrl label="Buffer Cap" value={config.buffer_size_limit} min={10} max={200} step={5} unit=" pings" color="#8b5cf6" onChange={v => dispatch('buffer_size_limit', v)} />
            <ToggleCtrl label="Interpolation" options={['Smooth', 'Literal']} value={config.interpolation_mode === 'smooth' ? 0 : 1} colors={['#14b8a6', '#f97316']} onChange={v => dispatch('interpolation_mode', v === 0 ? 'smooth' : 'literal')} />
          </ControlBlock>

          {/* Metrics */}
          <div className="zk-card" style={{ padding: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px', letterSpacing: '0.5px' }}>DERIVED METRICS</div>
            <MetricRow label="Ping Interval" value={derived?.ping_interval_ms ? `${derived.ping_interval_ms}ms` : 'Buffering'} />
            <MetricRow label="Pings/min" value={`${derived?.pings_per_minute ?? 0}`} />
            <MetricRow label="Confidence" value={derived?.confidence_width ?? 'narrow'} color={derived?.confidence_width === 'narrow' ? '#22c55e' : derived?.confidence_width === 'medium' ? '#eab308' : '#ef4444'} />
            <MetricRow label="Buffer Mode" value={derived?.buffer_mode === 'active' ? 'Active' : 'Standby'} color={derived?.buffer_mode === 'active' ? '#ef4444' : '#22c55e'} />
          </div>
        </div>
      </div>

      {/* Row 2: ETA + AI Decisions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flexShrink: 0, height: '200px' }}>
        <ETATimeline buses={buses} routes={routes} simConfig={simConfig} />
        <AIDecisionLog />
      </div>
    </div>
  );
}

function ControlBlock({ title, icon, children }) {
  return (
    <div className="zk-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.5px' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function SliderCtrl({ label, value, min, max, step = 1, unit, color, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: color || 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  );
}

function ToggleCtrl({ label, options, value, colors, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        {options.map((opt, i) => (
          <button key={opt} onClick={() => onChange(i)} style={{
            flex: 1, padding: '5px', fontSize: '13px', fontWeight: 600, borderRadius: '6px',
            border: `1px solid ${value === i ? colors[i] : 'var(--color-border)'}`,
            background: value === i ? `${colors[i]}18` : 'transparent',
            color: value === i ? colors[i] : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

function MetricRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '2px 0' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || 'var(--color-text)' }}>{value}</span>
    </div>
  );
}
