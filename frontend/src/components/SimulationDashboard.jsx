/**
 * SimulationDashboard.jsx — Mission Control Laboratory
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import MapView from './MapView';
import ETATimeline from './ETATimeline';
import AIDecisionLog from './AIDecisionLog';

const API_BASE = 'http://localhost:8000';

const SCENARIOS = [
  { id: 'rush_hour', title: 'RUSH HOUR', values: { signal_strength: 90, packet_loss: 5, latency_ms: 150, traffic_level: 2, weather: 0, buffer_size_limit: 50 } },
  { id: 'dead_zone', title: 'DEAD ZONE', values: { signal_strength: 0, packet_loss: 50, latency_ms: 2000, traffic_level: 0, weather: 0, buffer_size_limit: 50 } },
  { id: 'recovery', title: 'RECOVERY', values: null },
  { id: 'storm', title: 'STORM', values: { signal_strength: 35, packet_loss: 25, latency_ms: 800, traffic_level: 2, weather: 2, buffer_size_limit: 50 } },
];

const DEAD_VALUES = SCENARIOS[1].values;
const RECOVERY_VALUES = { signal_strength: 85, packet_loss: 5, latency_ms: 100, traffic_level: 1, weather: 0, buffer_size_limit: 50 };

const BUS_OPTIONS = [
  { id: null, label: 'ALL BUSES' },
  { id: 'bus_01', label: 'MIT-01' },
  { id: 'bus_02', label: 'HIN-02' },
  { id: 'bus_03', label: 'HAD-03' },
  { id: 'bus_04', label: 'KAT-04' },
  { id: 'bus_05', label: 'PUN-05' },
];

export default function SimulationDashboard({ simConfig, routes, buses, deadZones, mitaoe }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'hidden' }}>

      {/* Row 0: Bus Selector + Scenarios */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)', letterSpacing: '2px' }}>TARGET:</span>
          {BUS_OPTIONS.map(opt => (
            <button key={opt.label} onClick={() => setTargetBusId(opt.id)} className="font-label-caps" style={{
              padding: '6px 14px', borderRadius: '4px', fontSize: '11px',
              border: `1px solid ${targetBusId === opt.id ? 'var(--signal-cyan)' : 'var(--color-border)'}`,
              background: targetBusId === opt.id ? 'rgba(0, 242, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
              color: targetBusId === opt.id ? 'var(--signal-cyan)' : 'var(--color-text-secondary)',
              boxShadow: targetBusId === opt.id ? '0 0 10px rgba(0, 242, 255, 0.3)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>{opt.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {SCENARIOS.map(s => (
            <button key={s.id} onClick={() => handleScenario(s)} className="font-label-caps" style={{
              padding: '6px 16px', borderRadius: '4px', fontSize: '11px',
              border: `1px solid ${activeScenario === s.id ? (s.id === 'recovery' ? 'var(--signal-green)' : 'var(--signal-amber)') : 'var(--color-border)'}`,
              background: activeScenario === s.id ? (s.id === 'recovery' ? 'rgba(57, 255, 20, 0.1)' : 'rgba(249, 115, 22, 0.1)') : 'rgba(255, 255, 255, 0.03)',
              color: activeScenario === s.id ? (s.id === 'recovery' ? 'var(--signal-green)' : 'var(--signal-amber)') : 'var(--color-text-secondary)',
              boxShadow: activeScenario === s.id ? (s.id === 'recovery' ? '0 0 10px rgba(57, 255, 20, 0.3)' : '0 0 10px rgba(249, 115, 22, 0.3)') : 'none',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {s.title}
              {s.id === 'recovery' && recoveryCountdown !== null && (
                <span className="font-data-display" style={{ marginLeft: '6px', color: 'var(--signal-amber)', animation: 'signal-blink 0.8s infinite' }}>{recoveryCountdown}s</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Map (70%) + Controls (30%) */}
      <div style={{ display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '16px', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Simulation Map */}
        <div className="glass-card" style={{ position: 'relative', overflow: 'hidden', padding: '4px' }}>
          {/* Parameter readout overlay */}
          <div className="glass-card" style={{
            position: 'absolute', bottom: '16px', right: '16px', zIndex: 500,
            padding: '12px 16px', border: '1px solid var(--signal-cyan)',
          }}>
            <div className="font-label-caps glow-cyan" style={{ color: 'var(--signal-cyan)', marginBottom: '8px' }}>ACTIVE OVERRIDES</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'Inter' }}>Signal: <span className="font-data-display" style={{ color: 'var(--color-text)' }}>{config.signal_strength}%</span></div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'Inter' }}>Traffic: <span className="font-label-caps" style={{ color: 'var(--color-text)' }}>{['LOW', 'MEDIUM', 'HIGH'][config.traffic_level]}</span></div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'Inter' }}>Latency: <span className="font-data-display" style={{ color: 'var(--color-text)' }}>{config.latency_ms}ms</span></div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'Inter' }}>Loss: <span className="font-data-display" style={{ color: 'var(--color-text)' }}>{config.packet_loss}%</span></div>
          </div>

          <div style={{ width: '100%', height: '100%', borderRadius: '6px', overflow: 'hidden' }}>
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
        </div>

        {/* Control Panel */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ControlBlock title="NETWORK TELEMETRY" icon="">
            <SliderCtrl label="SIGNAL STRENGTH" value={config.signal_strength} min={0} max={100} unit="%" color={config.signal_strength >= 70 ? 'var(--signal-green)' : config.signal_strength >= 40 ? 'var(--signal-amber)' : 'var(--signal-red)'} onChange={v => dispatch('signal_strength', v)} />
            <SliderCtrl label="PACKET LOSS" value={config.packet_loss} min={0} max={50} unit="%" color={config.packet_loss > 25 ? 'var(--signal-red)' : 'var(--signal-cyan)'} onChange={v => dispatch('packet_loss', v)} />
            <SliderCtrl label="LATENCY (PING)" value={config.latency_ms} min={0} max={2000} step={50} unit="ms" color={config.latency_ms > 1000 ? 'var(--signal-red)' : 'var(--signal-cyan)'} onChange={v => dispatch('latency_ms', v)} />
          </ControlBlock>

          <ControlBlock title="ENVIRONMENT MATRIX" icon="">
            <ToggleCtrl label="TRAFFIC DENSITY" options={['LOW', 'MED', 'HIGH']} value={config.traffic_level} colors={['var(--signal-green)', 'var(--signal-amber)', 'var(--signal-red)']} onChange={v => dispatch('traffic_level', v)} />
            <ToggleCtrl label="WEATHER COND." options={['CLEAR', 'CLOUDY', 'STORM']} value={config.weather} colors={['var(--signal-cyan)', 'var(--signal-cyan)', 'var(--signal-amber)']} onChange={v => dispatch('weather', v)} />
          </ControlBlock>

          <ControlBlock title="SYSTEM OVERRIDES" icon="">
            <SliderCtrl label="BUFFER CAPACITY" value={config.buffer_size_limit} min={10} max={200} step={5} unit=" pings" color="var(--signal-cyan)" onChange={v => dispatch('buffer_size_limit', v)} />
            <ToggleCtrl label="INTERPOLATION" options={['SMOOTH', 'LITERAL']} value={config.interpolation_mode === 'smooth' ? 0 : 1} colors={['var(--signal-green)', 'var(--signal-amber)']} onChange={v => dispatch('interpolation_mode', v === 0 ? 'smooth' : 'literal')} />
          </ControlBlock>

          {/* Metrics */}
          <div className="glass-card" style={{ padding: '16px' }}>
            <div className="font-label-caps" style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }}>DERIVED METRICS</div>
            <MetricRow label="PING INTERVAL" value={derived?.ping_interval_ms ? `${derived.ping_interval_ms}ms` : 'BUFFERING'} />
            <MetricRow label="PINGS / MIN" value={`${derived?.pings_per_minute ?? 0}`} />
            <MetricRow label="AI CONFIDENCE" value={derived?.confidence_width?.toUpperCase() ?? 'NARROW'} color={derived?.confidence_width === 'narrow' ? 'var(--signal-green)' : derived?.confidence_width === 'medium' ? 'var(--signal-amber)' : 'var(--signal-red)'} />
            <MetricRow label="BUFFER STATE" value={derived?.buffer_mode === 'active' ? 'ACTIVE' : 'STANDBY'} color={derived?.buffer_mode === 'active' ? 'var(--signal-amber)' : 'var(--signal-green)'} />
          </div>
        </div>
      </div>

      {/* Row 2: ETA + AI Decisions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flexShrink: 0, height: '220px' }}>
        <div className="glass-card" style={{ padding: '16px' }}>
          <ETATimeline buses={buses} routes={routes} simConfig={simConfig} />
        </div>
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <AIDecisionLog />
        </div>
      </div>
    </div>
  );
}

function ControlBlock({ title, children }) {
  return (
    <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="font-label-caps" style={{ color: 'var(--signal-cyan)', textShadow: '0 0 8px rgba(0,242,255,0.4)', paddingBottom: '8px', borderBottom: '1px solid rgba(0,242,255,0.2)' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SliderCtrl({ label, value, min, max, step = 1, unit, color, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{label}</span>
        <span className="font-data-display" style={{ fontSize: '14px', color: color || 'var(--color-text)', textShadow: `0 0 8px ${color}80` }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ width: '100%' }} />
    </div>
  );
}

function ToggleCtrl({ label, options, value, colors, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', gap: '6px' }}>
        {options.map((opt, i) => (
          <button key={opt} onClick={() => onChange(i)} className="font-label-caps" style={{
            flex: 1, padding: '6px', fontSize: '10px', borderRadius: '4px',
            border: `1px solid ${value === i ? colors[i] : 'var(--color-border)'}`,
            background: value === i ? `rgba(${value===0?'0,242,255':'249,115,22'},0.1)` : 'transparent',
            color: value === i ? colors[i] : 'var(--color-text-muted)',
            boxShadow: value === i ? `0 0 8px ${colors[i]}40` : 'none',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

function MetricRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', alignItems: 'center' }}>
      <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="font-data-display" style={{ fontSize: '14px', color: color || 'var(--color-text)', textShadow: color ? `0 0 8px ${color}80` : 'none' }}>{value}</span>
    </div>
  );
}
