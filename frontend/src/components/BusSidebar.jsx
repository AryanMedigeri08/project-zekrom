/**
 * BusSidebar.jsx — Phase 6: Priority sort, bigger fonts, themed.
 */

import React, { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

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
  if (score > 150) return { label: 'CRITICAL', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' };
  if (score >= 100) return { label: 'HIGH', color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' };
  if (score >= 50) return { label: 'MEDIUM', color: '#eab308', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.3)' };
  return { label: 'NOMINAL', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)' };
}

export default function BusSidebar({ buses, selectedBusId, onSelectBus, mode, hideTrackButton = false }) {
  const { theme } = useTheme();

  const sortedBuses = useMemo(() => {
    return Object.entries(buses || {})
      .map(([id, b]) => ({ ...b, bus_id: id, _priority: computePriority(b) }))
      .sort((a, b) => b._priority - a._priority);
  }, [buses]);

  const alertCount = sortedBuses.filter(b => b._priority >= 100).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflowY: 'auto' }}>
      {/* Summary */}
      <div className="zk-card" style={{
        padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {alertCount > 0 ? (
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#ef4444' }}>
            {alertCount} bus{alertCount > 1 ? 'es' : ''} need attention
          </span>
        ) : (
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e' }}>All buses nominal</span>
        )}
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{sortedBuses.length - alertCount} OK</span>
      </div>

      {/* Bus cards */}
      {sortedBuses.map((bus) => {
        const badge = getPriorityBadge(bus._priority);
        const sig = bus.signal_strength ?? 85;
        const sigColor = sig >= 70 ? '#22c55e' : sig >= 40 ? '#eab308' : '#ef4444';
        const conf = bus.confidence_score ?? 0.8;
        const confColor = conf >= 0.75 ? '#22c55e' : conf >= 0.5 ? '#eab308' : '#ef4444';
        const isSelected = selectedBusId === bus.bus_id && mode === '3d';

        return (
          <div key={bus.bus_id} className="zk-card" style={{
            padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
            borderLeft: `3px solid ${bus.color || '#888'}`,
            outline: isSelected ? '2px solid #6366f1' : 'none',
            outlineOffset: '1px',
          }}>
            {/* Label + badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>{bus.label || bus.bus_id}</div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>{bus.route_name || bus.route_id}</div>
              </div>
              <span style={{
                fontSize: '12px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px',
                border: `1px solid ${badge.border}`, background: badge.bg, color: badge.color,
              }}>{badge.label}</span>
            </div>

            {/* Signal bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Signal</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: sigColor, fontVariantNumeric: 'tabular-nums' }}>{sig}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '3px', width: `${Math.min(100, sig)}%`, background: sigColor, transition: 'width 0.5s' }} />
              </div>
            </div>

            {/* Confidence bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Confidence</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: confColor, fontVariantNumeric: 'tabular-nums' }}>{Math.round(conf * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '3px', width: `${Math.round(conf * 100)}%`, background: confColor, transition: 'width 0.5s' }} />
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Speed</span>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{bus.speed_kmh?.toFixed(1) ?? '—'} km/h</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Traffic</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize', color: bus.traffic_level === 'high' ? '#ef4444' : bus.traffic_level === 'low' ? '#22c55e' : '#eab308' }}>
                  {bus.traffic_level ?? 'medium'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Buffer</span>
                <span style={{ fontWeight: 600, color: bus.buffer_size > 0 ? '#f97316' : 'var(--color-text-muted)' }}>{bus.buffer_size ?? 0}</span>
              </div>
              {bus.dead_zone?.active && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#7c3aed' }}>DZ: {bus.dead_zone.name}</span>
                </div>
              )}
            </div>

            {/* Track in 3D button */}
            {onSelectBus && !hideTrackButton && (
              <button onClick={() => onSelectBus(bus.bus_id)} disabled={isSelected} style={{
                width: '100%', padding: '6px', fontSize: '13px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: isSelected ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                background: isSelected ? 'var(--color-bg-secondary)' : '#6366f1',
                color: isSelected ? 'var(--color-text-muted)' : '#fff',
              }}>
                <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
                {isSelected ? 'Tracking' : 'Track in 3D'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
