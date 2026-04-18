/**
 * CompactStatusStrip — Thin bottom bar shown in 3D mode.
 *
 * Displays key bus metrics in a single horizontal row.
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
  const statusDot = isGhost ? 'bg-red-500' : sig >= 70 ? 'bg-green-500' : sig >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex-shrink-0 h-12 bg-gray-900/95 backdrop-blur-md border-t border-gray-800 flex items-center px-5 gap-6 z-40">
      {/* Bus label */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: sigColor }}>
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6" />
          </svg>
        </div>
        <span className="text-sm font-bold text-white">{bus.label || bus.bus_id}</span>
      </div>

      <Divider />

      {/* Signal */}
      <StripItem label="Signal">
        <div className="flex items-center gap-1.5">
          <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${sig}%`, background: sigColor }} />
          </div>
          <span className="text-xs font-bold tabular-nums" style={{ color: sigColor }}>{sig}%</span>
        </div>
      </StripItem>

      <Divider />

      <StripItem label="Speed">
        <span className="text-xs font-semibold text-gray-200 tabular-nums">
          {bus.speed_kmh?.toFixed(1) ?? '—'} km/h
        </span>
      </StripItem>

      <Divider />

      <StripItem label="Traffic">
        <span className="text-xs font-semibold capitalize" style={{ color: trafColor }}>
          {bus.traffic_level ?? 'medium'}
        </span>
      </StripItem>

      <Divider />

      <StripItem label="Next">
        <span className="text-xs font-semibold text-gray-200 truncate max-w-[120px]">
          {bus.next_stop || '—'}
        </span>
      </StripItem>

      <Divider />

      <StripItem label="Buffer">
        <span className={`text-xs font-semibold ${bus.buffer_size > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
          {bus.buffer_size ?? 0}
        </span>
      </StripItem>

      <Divider />

      <StripItem label="Mode">
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${statusDot} animate-pulse`} />
          <span className="text-[10px] font-bold text-gray-400 tracking-wider">{statusLabel}</span>
        </div>
      </StripItem>
    </div>
  );
}

function StripItem({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-gray-600 font-medium tracking-wide uppercase">{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-800" />;
}
