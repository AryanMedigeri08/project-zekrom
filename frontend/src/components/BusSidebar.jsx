/**
 * BusSidebar.jsx — Mission Control Signal Health Bar
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
  if (score > 150) return { label: 'CRITICAL', color: 'var(--signal-red)', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' };
  if (score >= 100) return { label: 'HIGH', color: 'var(--signal-amber)', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.3)' };
  if (score >= 50) return { label: 'MEDIUM', color: 'var(--signal-cyan)', bg: 'rgba(0,242,255,0.1)', border: 'rgba(0,242,255,0.3)' };
  return { label: 'NOMINAL', color: 'var(--signal-green)', bg: 'rgba(57,255,20,0.1)', border: 'rgba(57,255,20,0.3)' };
}

export default function BusSidebar({ buses, selectedBusId, onSelectBus, mode, hideTrackButton = false }) {
  const sortedBuses = useMemo(() => {
    return Object.entries(buses || {})
      .map(([id, b]) => ({ ...b, bus_id: id, _priority: computePriority(b) }))
      .sort((a, b) => b._priority - a._priority);
  }, [buses]);

  const alertCount = sortedBuses.filter(b => b._priority >= 100).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflowY: 'auto' }}>
      {/* Summary */}
      <div className="glass-card" style={{
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {alertCount > 0 ? (
          <span className="font-label-caps" style={{ fontSize: '12px', color: 'var(--signal-red)', textShadow: '0 0 8px rgba(239,68,68,0.5)' }}>
            {alertCount} BUS{alertCount > 1 ? 'ES' : ''} REQUIRE ATTENTION
          </span>
        ) : (
          <span className="font-label-caps" style={{ fontSize: '12px', color: 'var(--signal-green)', textShadow: '0 0 8px rgba(57,255,20,0.5)' }}>
            ALL BUSES NOMINAL
          </span>
        )}
        <span className="font-data-display" style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{sortedBuses.length - alertCount} OK</span>
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
            padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
            borderLeft: `2px solid ${bus.color || 'var(--signal-cyan)'}`,
            border: isSelected ? '1px solid var(--signal-cyan)' : '1px solid var(--color-border)',
            boxShadow: isSelected ? '0 0 15px rgba(0, 242, 255, 0.3)' : 'none',
          }}>
            {/* Label + badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="font-data-display" style={{ fontSize: '18px', color: 'var(--color-text)', lineHeight: 1.2 }}>{bus.label || bus.bus_id}</div>
                <div className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-secondary)', lineHeight: 1.5, letterSpacing: '2px' }}>{bus.route_name || bus.route_id}</div>
              </div>
              <span className="font-label-caps" style={{
                fontSize: '10px', padding: '4px 10px', borderRadius: '4px',
                border: `1px solid ${badge.border}`, background: badge.bg, color: badge.color,
                boxShadow: `0 0 8px ${badge.color}40`,
              }}>{badge.label}</span>
            </div>

            {/* Signal bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>SIGNAL STRENGTH</span>
                <span className="font-data-display" style={{ fontSize: '14px', color: sigColor, textShadow: `0 0 8px ${sigColor}80` }}>{sig}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '2px', width: `${Math.min(100, sig)}%`, background: sigColor, transition: 'width 0.5s', boxShadow: `0 0 8px ${sigColor}` }} />
              </div>
            </div>

            {/* Confidence bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>AI CONFIDENCE</span>
                <span className="font-data-display" style={{ fontSize: '14px', color: confColor, textShadow: `0 0 8px ${confColor}80` }}>{Math.round(conf * 100)}%</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '2px', width: `${Math.round(conf * 100)}%`, background: confColor, transition: 'width 0.5s', boxShadow: `0 0 8px ${confColor}` }} />
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>SPEED</span>
                <span className="font-data-display" style={{ fontSize: '13px', color: 'var(--color-text)' }}>{bus.speed_kmh?.toFixed(1) ?? '—'}<span style={{fontSize:'10px', color:'var(--color-text-secondary)', marginLeft:'2px'}}>km/h</span></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>TRAFFIC</span>
                <span className="font-label-caps" style={{ fontSize: '10px', color: bus.traffic_level === 'high' ? 'var(--signal-red)' : bus.traffic_level === 'low' ? 'var(--signal-green)' : 'var(--signal-amber)' }}>
                  {bus.traffic_level ?? 'MEDIUM'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>BUFFER</span>
                <span className="font-data-display" style={{ fontSize: '13px', color: bus.buffer_size > 0 ? 'var(--signal-amber)' : 'var(--color-text-muted)' }}>{bus.buffer_size ?? 0}</span>
              </div>
              {bus.dead_zone?.active && (
                <div style={{ gridColumn: 'span 2', marginTop: '4px' }}>
                  <span className="font-label-caps" style={{ fontSize: '11px', color: 'var(--signal-cyan)', padding: '2px 6px', background: 'rgba(0,242,255,0.1)', borderRadius:'4px' }}>DZ: {bus.dead_zone.name}</span>
                </div>
              )}
            </div>

            {/* Track in 3D button */}
            {onSelectBus && !hideTrackButton && (
              <button onClick={() => onSelectBus(bus.bus_id)} disabled={isSelected} className="font-label-caps glow-cyan" style={{
                marginTop: '6px', width: '100%', padding: '10px', fontSize: '11px', borderRadius: '4px', border: isSelected ? '1px solid var(--signal-cyan)' : '1px solid var(--color-border)', cursor: isSelected ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: isSelected ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.05)',
                color: isSelected ? 'var(--signal-cyan)' : 'var(--color-text)',
                transition: 'all 0.2s',
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
