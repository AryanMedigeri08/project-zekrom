/**
 * BusSidebar — Phase 5: Priority-sorted bus cards with confidence bars.
 */

import React, { useMemo } from 'react';

// Priority scoring
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
  if (score > 150) return { label: 'CRITICAL', color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca' };
  if (score >= 100) return { label: 'HIGH', color: '#f97316', bgColor: '#fff7ed', borderColor: '#fed7aa' };
  if (score >= 50) return { label: 'MEDIUM', color: '#eab308', bgColor: '#fefce8', borderColor: '#fef08a' };
  return { label: 'NOMINAL', color: '#22c55e', bgColor: '#f0fdf4', borderColor: '#bbf7d0' };
}

function getSignalColor(sig) {
  if (sig >= 70) return '#22c55e';
  if (sig >= 40) return '#eab308';
  return '#ef4444';
}

function getConfidenceColor(val) {
  const pct = (val || 0) * 100;
  if (pct >= 75) return '#22c55e';
  if (pct >= 50) return '#eab308';
  return '#ef4444';
}

const CubeIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>
);

export default function BusSidebar({ buses, selectedBusId, onSelectBus, mode }) {
  // Sort by priority (highest first)
  const sortedBuses = useMemo(() => {
    return Object.entries(buses || {})
      .map(([id, b]) => ({ ...b, bus_id: id, _priority: computePriority(b) }))
      .sort((a, b) => b._priority - a._priority);
  }, [buses]);

  const alertCount = sortedBuses.filter(b => b._priority >= 100).length;
  const nominalCount = sortedBuses.length - alertCount;

  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto">
      {/* Summary strip */}
      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
        {alertCount > 0 ? (
          <span className="text-[10px] font-bold text-red-500">
            <svg className="w-3 h-3 inline mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
            </svg>
            {alertCount} bus{alertCount > 1 ? 'es' : ''} need attention
          </span>
        ) : (
          <span className="text-[10px] font-bold text-green-600">All buses nominal</span>
        )}
        <span className="text-[10px] text-gray-400">{nominalCount} OK</span>
      </div>

      {/* Bus cards */}
      {sortedBuses.map((bus) => {
        const busId = bus.bus_id;
        const badge = getPriorityBadge(bus._priority);
        const sig = bus.signal_strength ?? 85;
        const sigColor = getSignalColor(sig);
        const conf = bus.confidence_score ?? 0.8;
        const confColor = getConfidenceColor(conf);
        const isSelected = selectedBusId === busId && mode === '3d';

        return (
          <div key={busId}
            className={`card-panel p-2.5 flex flex-col gap-1.5 transition-all min-w-[220px] ${
              isSelected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
            }`}
            style={{ borderLeftWidth: '3px', borderLeftColor: bus.color || '#888' }}>
            {/* Row 1: Label + Priority badge */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-gray-800" style={{ whiteSpace: 'nowrap', overflow: 'visible' }}>
                  {bus.label || busId}
                </div>
                <div className="text-[10px] text-gray-500" style={{ whiteSpace: 'nowrap', overflow: 'visible' }}>
                  {bus.route_name || bus.route_id}
                </div>
              </div>
              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full border"
                style={{ color: badge.color, backgroundColor: badge.bgColor, borderColor: badge.borderColor }}>
                {badge.label}
              </span>
            </div>

            {/* Signal bar */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-gray-400">Signal</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: sigColor }}>{sig}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, sig)}%`, background: sigColor }} />
              </div>
            </div>

            {/* Confidence bar */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-gray-400">Confidence</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: confColor }}>{Math.round(conf * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(conf * 100)}%`, background: confColor }} />
              </div>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Speed</span>
                <span className="text-gray-700 font-semibold">{bus.speed_kmh?.toFixed(1) ?? '—'} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Traffic</span>
                <span className="font-semibold capitalize" style={{ color: bus.traffic_level === 'high' ? '#ef4444' : bus.traffic_level === 'low' ? '#22c55e' : '#eab308' }}>
                  {bus.traffic_level ?? 'medium'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Buffer</span>
                <span className={`font-semibold ${bus.buffer_size > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                  {bus.buffer_size ?? 0}
                </span>
              </div>
              {bus.dead_zone?.active && (
                <div className="flex justify-between col-span-2">
                  <span className="text-purple-500 font-semibold text-[9px]">
                    DZ: {bus.dead_zone.name}
                  </span>
                </div>
              )}
            </div>

            {/* Track in 3D button */}
            {onSelectBus && (
              <button onClick={() => onSelectBus(busId)} disabled={isSelected}
                className={`w-full mt-0.5 py-1 text-[9px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-indigo-100 text-indigo-400 border border-indigo-200 cursor-default'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                }`}>
                <CubeIcon />
                {isSelected ? 'Currently Tracking' : 'Track in 3D'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
