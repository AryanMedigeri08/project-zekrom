/**
 * CompactStatusStrip.jsx — Phase 6: Theme-aware bottom bar for 3D mode.
 */

import React from 'react';

function getSignalColor(sig) {
  if (sig >= 70) return '#22c55e';
  if (sig >= 40) return '#eab308';
  return '#ef4444';
}

function getTrafficColor(level) {
  if (level === 'low') return '#22c55e';
  if (level === 'high') return '#ef4444';
  return '#eab308';
}

export default function CompactStatusStrip({ bus }) {
  if (!bus) return null;

  const sig = bus.signal_strength ?? 0;
  const sigColor = getSignalColor(sig);
  const trafColor = getTrafficColor(bus.traffic_level ?? 'medium');
  const isGhost = bus.is_ghost;
  const statusLabel = isGhost ? 'GHOST' : sig >= 70 ? 'LIVE' : sig >= 40 ? 'SPARSE' : 'WEAK';
  const dotColor = isGhost ? '#ef4444' : sig >= 70 ? '#22c55e' : sig >= 40 ? '#eab308' : '#ef4444';

  return (
    <div style={{
      flexShrink: 0, height: '48px', display: 'flex', alignItems: 'center', gap: '20px',
      padding: '0 20px', zIndex: 40,
      background: 'var(--color-nav-bg)', borderTop: '1px solid var(--color-border)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* Bus label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px', background: sigColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: '#fff'
        }}>BUS</div>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>{bus.label || bus.bus_id}</span>
      </div>

      <Divider />

      <StripItem label="Signal">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '80px', height: '5px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '3px', width: `${sig}%`, background: sigColor, transition: 'width 0.5s' }} />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: sigColor, fontVariantNumeric: 'tabular-nums' }}>{sig}%</span>
        </div>
      </StripItem>

      <Divider />

      <StripItem label="Speed">
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
          {bus.speed_kmh?.toFixed(1) ?? '—'} km/h
        </span>
      </StripItem>

      <Divider />

      <StripItem label="Traffic">
        <span style={{ fontSize: '13px', fontWeight: 600, color: trafColor, textTransform: 'capitalize' }}>
          {bus.traffic_level ?? 'medium'}
        </span>
      </StripItem>

      <Divider />

      <StripItem label="Next">
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bus.next_stop || '—'}
        </span>
      </StripItem>

      <Divider />

      <StripItem label="Buffer">
        <span style={{ fontSize: '13px', fontWeight: 600, color: bus.buffer_size > 0 ? '#f97316' : 'var(--color-text-muted)' }}>
          {bus.buffer_size ?? 0}
        </span>
      </StripItem>

      <Divider />

      <StripItem label="Mode">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, animation: 'signal-blink 1.5s infinite' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '1px' }}>{statusLabel}</span>
        </div>
      </StripItem>
    </div>
  );
}

function StripItem({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ width: '1px', height: '20px', background: 'var(--color-border)' }} />;
}
