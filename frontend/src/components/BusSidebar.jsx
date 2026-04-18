/**
 * BusSidebar.jsx — Professional Clean Dashboard
 */

import React, { useMemo } from 'react';

function computePriority(bus) {
  let score = 0;
  const sig = bus.signal_strength ?? 85;
  if (sig < 40) score += 100;
  if (bus.is_ghost) score += 80;
  if (bus.in_dead_zone || bus.dead_zone?.active) score += 60;
  if ((bus.buffer_size ?? 0) > 10) score += 40;
  if (bus.traffic_level === 'high') score += 20;
  return score;
}

function getPriorityBadge(score) {
  if (score > 150) return { label: 'CRITICAL', color: 'var(--signal-red)', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' };
  if (score >= 100) return { label: 'ATTENTION', color: 'var(--signal-amber)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' };
  if (score >= 50) return { label: 'MONITORING', color: 'var(--signal-cyan)', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)' };
  return { label: 'HEALTHY', color: 'var(--signal-green)', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' };
}

export default function BusSidebar({ buses, selectedBusId, onSelectBus, mode, hideTrackButton = false }) {
  const sortedBuses = useMemo(() => {
    return Object.entries(buses || {})
      .map(([id, b]) => ({ ...b, bus_id: id, _priority: computePriority(b) }))
      .sort((a, b) => b._priority - a._priority);
  }, [buses]);

  const alertCount = sortedBuses.filter(b => b._priority >= 100).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
      {/* Summary */}
      <div className="glass-card" style={{
        padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--color-bg-card)',
      }}>
        {alertCount > 0 ? (
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--signal-red)' }}>
            {alertCount} BUS{alertCount > 1 ? 'ES' : ''} REQUIRE ATTENTION
          </span>
        ) : (
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--signal-green)' }}>
            ALL SYSTEMS NOMINAL
          </span>
        )}
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{sortedBuses.length - alertCount} OK</span>
      </div>

      {/* Bus cards */}
      {sortedBuses.map((bus) => {
        const badge = getPriorityBadge(bus._priority);
        const sig = bus.signal_strength ?? 85;
        const sigColor = sig >= 70 ? 'var(--signal-green)' : sig >= 40 ? 'var(--signal-amber)' : 'var(--signal-red)';
        const conf = bus.confidence_score ?? 0.8;
        const confColor = conf >= 0.75 ? 'var(--signal-green)' : conf >= 0.5 ? 'var(--signal-amber)' : 'var(--signal-red)';
        const isSelected = selectedBusId === bus.bus_id && mode === '3d';

        return (
          <div key={bus.bus_id} className="glass-card" style={{
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
            borderLeft: `4px solid ${bus.color || 'var(--signal-cyan)'}`,
            borderTop: isSelected ? '1px solid var(--signal-cyan)' : '1px solid var(--color-border)',
            borderRight: isSelected ? '1px solid var(--signal-cyan)' : '1px solid var(--color-border)',
            borderBottom: isSelected ? '1px solid var(--signal-cyan)' : '1px solid var(--color-border)',
            boxShadow: isSelected ? '0 4px 15px rgba(99, 102, 241, 0.15)' : '0 4px 10px rgba(0,0,0,0.02)',
            background: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--color-bg-card)',
          }}>
            {/* Label + badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>{bus.label || bus.bus_id}</div>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{bus.route_name || bus.route_id}</div>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
                border: `1px solid ${badge.border}`, background: badge.bg, color: badge.color,
              }}>{badge.label}</span>
            </div>

            {/* Signal bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="font-label-caps" style={{ color: 'var(--color-text-muted)' }}>Signal Strength</span>
                <span className="font-data-display" style={{ fontSize: '13px', color: sigColor }}>{sig}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--color-border-darker)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '3px', width: `${Math.min(100, sig)}%`, background: sigColor, transition: 'width 0.5s' }} />
              </div>
            </div>

            {/* Confidence bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="font-label-caps" style={{ color: 'var(--color-text-muted)' }}>AI Confidence</span>
                <span className="font-data-display" style={{ fontSize: '13px', color: confColor }}>{Math.round(conf * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--color-border-darker)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '3px', width: `${Math.round(conf * 100)}%`, background: confColor, transition: 'width 0.5s' }} />
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-label-caps">Speed</span>
                <span className="font-data-display" style={{ fontSize: '13px' }}>{bus.speed_kmh?.toFixed(1) ?? '—'} <span style={{fontSize:'10px', fontWeight:500, color:'var(--color-text-muted)'}}>km/h</span></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-label-caps">Traffic</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: bus.traffic_level === 'high' ? 'var(--signal-red)' : bus.traffic_level === 'low' ? 'var(--signal-green)' : 'var(--signal-amber)' }}>
                  {(bus.traffic_level ?? 'MEDIUM').toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-label-caps">Buffer</span>
                <span className="font-data-display" style={{ fontSize: '13px', color: bus.buffer_size > 0 ? 'var(--signal-amber)' : 'var(--color-text)' }}>{bus.buffer_size ?? 0}</span>
              </div>
              {bus.dead_zone?.active && (
                <div style={{ gridColumn: 'span 2', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--signal-amber)', padding: '4px 8px', background: 'rgba(245,158,11,0.1)', borderRadius:'4px' }}>Dead Zone: {bus.dead_zone.name}</span>
                </div>
              )}
            </div>

            {/* Track in 3D button */}
            {onSelectBus && !hideTrackButton && (
              <button onClick={() => onSelectBus(bus.bus_id)} disabled={isSelected} style={{
                marginTop: '8px', width: '100%', padding: '12px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', 
                border: isSelected ? '1px solid var(--signal-cyan)' : '1px solid var(--color-border)', 
                cursor: isSelected ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: isSelected ? 'rgba(99,102,241,0.1)' : 'var(--color-bg)',
                color: isSelected ? 'var(--signal-cyan)' : 'var(--color-text-secondary)',
                transition: 'all 0.2s',
                boxShadow: isSelected ? 'none' : '0 2px 5px rgba(0,0,0,0.02)'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>flight_takeoff</span>
                {isSelected ? 'TRACKING ACTIVE' : 'OPEN IN 3D MAP'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
