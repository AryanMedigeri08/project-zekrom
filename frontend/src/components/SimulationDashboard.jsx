/**
 * SimulationDashboard.jsx — Phase 8: Simulation Lab with Layer Activity Monitor.
 *
 * Layout:
 * ┌──────────────────────────────────────────────┐
 * │  COMPACT CONTROL BAR (full width, ~auto h)   │
 * ├──────────────────────┬───────────────────────┤
 * │  SIMULATION MAP 70%  │  LAYER ACTIVITY       │
 * │                      │  MONITOR 30%          │
 * ├──────────────────────┴───────────────────────┤
 * │  ETA Timeline (full width)                   │
 * └──────────────────────────────────────────────┘
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import MapView from './MapView';
import ETATimeline from './ETATimeline';
import LayerActivityMonitor from './LayerActivityMonitor';

const API_BASE = 'http://localhost:8000';

const SCENARIOS = [
  { id: 'rush_hour', title: 'RUSH HOUR', icon: '🚦', values: { signal_strength: 90, packet_loss: 5, latency_ms: 150, traffic_level: 2, weather: 0, buffer_size_limit: 50 } },
  { id: 'dead_zone', title: 'DEAD ZONE', icon: '📡', values: { signal_strength: 0, packet_loss: 50, latency_ms: 2000, traffic_level: 0, weather: 0, buffer_size_limit: 50 } },
  { id: 'recovery', title: 'RECOVERY', icon: '🔄', values: null },
  { id: 'storm', title: 'STORM', icon: '⛈', values: { signal_strength: 35, packet_loss: 25, latency_ms: 800, traffic_level: 2, weather: 2, buffer_size_limit: 50 } },
];

const DEAD_VALUES = SCENARIOS[1].values;
const RECOVERY_VALUES = { signal_strength: 85, packet_loss: 5, latency_ms: 100, traffic_level: 1, weather: 0, buffer_size_limit: 50 };

const BUS_OPTIONS = [
  { id: null, label: 'ALL' },
  { id: 'bus_01', label: 'MIT-01' },
  { id: 'bus_02', label: 'HIN-02' },
  { id: 'bus_03', label: 'HAD-03' },
  { id: 'bus_04', label: 'KAT-04' },
  { id: 'bus_05', label: 'PUN-05' },
];

const SLIDER_DEFS = [
  { key: 'signal_strength', label: 'Signal', min: 0, max: 100, step: 1, unit: '%', getColor: v => v >= 70 ? '#22c55e' : v >= 40 ? '#f59e0b' : '#ef4444' },
  { key: 'packet_loss', label: 'Loss', min: 0, max: 50, step: 1, unit: '%', getColor: v => v > 25 ? '#ef4444' : '#6366f1' },
  { key: 'latency_ms', label: 'Latency', min: 0, max: 2000, step: 50, unit: 'ms', getColor: v => v > 1000 ? '#ef4444' : '#6366f1' },
  { key: 'traffic_level', label: 'Traffic', min: 0, max: 2, step: 1, unit: '', getColor: v => v === 0 ? '#22c55e' : v === 1 ? '#f59e0b' : '#ef4444', format: v => ['LOW', 'MED', 'HIGH'][v] },
  { key: 'weather', label: 'Weather', min: 0, max: 2, step: 1, unit: '', getColor: () => '#6366f1', format: v => ['CLR', 'CLD', 'STM'][v] },
  { key: 'buffer_size_limit', label: 'Buffer', min: 10, max: 200, step: 5, unit: '', getColor: () => '#6366f1' },
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ══════════ COMPACT CONTROL BAR (sticky top) ══════════ */}
      <div className="glass-card compact-control-bar" style={{
        padding: '10px 16px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: '8px',
        zIndex: 10,
      }}>
        {/* Row 1: Bus Selector + Sliders */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Bus selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}>TARGET</span>
            {BUS_OPTIONS.map(opt => (
              <button key={opt.label} onClick={() => setTargetBusId(opt.id)} style={{
                padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                border: `1px solid ${targetBusId === opt.id ? 'var(--signal-cyan)' : 'var(--color-border)'}`,
                background: targetBusId === opt.id ? 'rgba(99,102,241,0.1)' : 'transparent',
                color: targetBusId === opt.id ? 'var(--signal-cyan)' : 'var(--color-text-muted)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{opt.label}</button>
            ))}
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--color-border)', flexShrink: 0 }} />

          {/* Inline sliders */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, flexWrap: 'wrap' }}>
            {SLIDER_DEFS.map(sl => {
              const val = config[sl.key] ?? sl.min;
              const color = sl.getColor(val);
              const display = sl.format ? sl.format(val) : `${val}${sl.unit}`;
              return (
                <div key={sl.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '120px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', width: '42px' }}>{sl.label}</span>
                  <input
                    type="range" min={sl.min} max={sl.max} step={sl.step}
                    value={val}
                    onChange={e => dispatch(sl.key, Number(e.target.value))}
                    style={{ width: '70px', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 700, color, minWidth: '32px', fontVariantNumeric: 'tabular-nums' }}>{display}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2: Scenarios + Derived Metrics */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}>SCENARIO</span>
            {SCENARIOS.map(s => (
              <button key={s.id} onClick={() => handleScenario(s)} style={{
                padding: '4px 10px', borderRadius: '5px', fontSize: '10px', fontWeight: 700,
                border: `1px solid ${activeScenario === s.id ? (s.id === 'recovery' ? '#22c55e' : '#f59e0b') : 'var(--color-border)'}`,
                background: activeScenario === s.id ? (s.id === 'recovery' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)') : 'transparent',
                color: activeScenario === s.id ? (s.id === 'recovery' ? '#22c55e' : '#f59e0b') : 'var(--color-text-muted)',
                cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <span style={{ fontSize: '11px' }}>{s.icon}</span>
                {s.title}
                {s.id === 'recovery' && recoveryCountdown !== null && (
                  <span style={{ color: '#f59e0b', animation: 'signal-blink 0.8s infinite' }}>{recoveryCountdown}s</span>
                )}
              </button>
            ))}
          </div>

          {/* Compact derived metrics */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>PING</span>
              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{derived?.ping_interval_ms ? `${derived.ping_interval_ms}ms` : 'BUF'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>CONF</span>
              <span style={{
                fontWeight: 700,
                color: derived?.confidence_width === 'narrow' ? '#22c55e' : derived?.confidence_width === 'medium' ? '#f59e0b' : '#ef4444',
              }}>{(derived?.confidence_width || 'narrow').toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>BUF</span>
              <span style={{
                fontWeight: 700,
                color: derived?.buffer_mode === 'active' ? '#f59e0b' : '#22c55e',
              }}>{derived?.buffer_mode === 'active' ? 'ACTIVE' : 'STBY'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ SCROLLABLE CONTENT AREA ══════════ */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column', gap: '12px',
        padding: '12px 0 24px 0',
      }}>

        {/* ── Row 1: Map (70%) + Layer Monitor (30%) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '70fr 30fr',
          gap: '12px',
          minHeight: '500px',
        }}>
          {/* Simulation Map */}
          <div className="glass-card" style={{ position: 'relative', overflow: 'hidden', padding: '4px', minHeight: '500px' }}>
            {/* Parameter readout overlay */}
            <div className="glass-card" style={{
              position: 'absolute', bottom: '12px', right: '12px', zIndex: 500,
              padding: '10px 14px', border: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)', boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
              fontSize: '11px',
            }}>
              <div style={{ fontWeight: 700, color: 'var(--signal-cyan)', letterSpacing: '0.05em', marginBottom: '4px', fontSize: '10px' }}>ACTIVE OVERRIDES</div>
              <div style={{ color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>Signal: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{config.signal_strength}%</span></div>
              <div style={{ color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>Traffic: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{['LOW', 'MEDIUM', 'HIGH'][config.traffic_level]}</span></div>
              <div style={{ color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>Latency: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{config.latency_ms}ms</span></div>
            </div>

            <div style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden' }}>
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

          {/* Layer Activity Monitor — full height of this row */}
          <LayerActivityMonitor
            buses={buses}
            simConfig={simConfig}
            activeScenario={activeScenario}
          />
        </div>

        {/* ── Row 2: ETA Timeline (70% width, aligned to map) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '70fr 30fr',
          gap: '12px',
        }}>
          <ETATimeline buses={buses} routes={routes} simConfig={simConfig} />
          <div /> {/* Empty spacer to maintain grid alignment */}
        </div>
      </div>
    </div>
  );
}
