/**
 * BusSidebar — Per-bus fleet cards with "Track in 3D" button.
 */

import React from 'react';

const BusIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-9.75a3.375 3.375 0 00-3.375-3.375h-9A3.375 3.375 0 005.25 7.875v6.375m13.5 4.5V7.875" />
  </svg>
);

const CubeIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>
);

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

function getStatusLabel(bus) {
  if (bus.is_ghost) return { label: 'Ghost', color: 'text-red-500', dot: 'bg-red-500' };
  if ((bus.signal_strength ?? 85) < 40) return { label: 'Sparse', color: 'text-orange-500', dot: 'bg-orange-400' };
  return { label: 'Live', color: 'text-green-600', dot: 'bg-green-500' };
}

const ROUTE_COLORS = {
  route_purple: { tagBg: 'bg-purple-100', tag: 'text-purple-600' },
  route_teal:   { tagBg: 'bg-teal-100',   tag: 'text-teal-600' },
  route_orange: { tagBg: 'bg-orange-100',  tag: 'text-orange-600' },
};

export default function BusSidebar({ buses, selectedBusId, onSelectBus, mode }) {
  const busEntries = Object.entries(buses || {}).sort((a, b) => a[0].localeCompare(b[0]));
  if (busEntries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-teal-600"><BusIcon className="w-3.5 h-3.5" /></span>
        <span className="text-[10px] font-bold text-gray-500 tracking-wide uppercase">Fleet Status</span>
      </div>

      {busEntries.map(([busId, bus]) => {
        const status = getStatusLabel(bus);
        const routeStyle = ROUTE_COLORS[bus.route_id] || ROUTE_COLORS.route_teal;
        const sigColor = getSignalColor(bus.signal_strength ?? 85);
        const trafColor = getTrafficColor(bus.traffic_level ?? 'medium');
        const sigPct = Math.min(100, Math.max(0, bus.signal_strength ?? 0));
        const isSelected = selectedBusId === busId && mode === '3d';

        return (
          <div key={busId} className={`card-panel p-3 flex flex-col gap-2 transition-all ${
            isSelected ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: sigColor }}>
                  <span className="text-white text-[7px] font-extrabold">{bus.label}</span>
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-700">{bus.label}</span>
                  <span className={`ml-1.5 text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${routeStyle.tagBg} ${routeStyle.tag}`}>
                    {bus.route_id?.replace('route_', '').toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                <span className={`text-[9px] font-semibold ${status.color}`}>{status.label}</span>
              </div>
            </div>

            {/* Signal bar */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-gray-400">Signal</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: sigColor }}>{sigPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${sigPct}%`, background: sigColor }} />
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
              <div className="flex justify-between">
                <span className="text-gray-400">Speed</span>
                <span className="text-gray-700 font-semibold">{bus.speed_kmh?.toFixed(1) ?? '—'} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Traffic</span>
                <span className="font-semibold capitalize" style={{ color: trafColor }}>{bus.traffic_level ?? 'medium'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Next Stop</span>
                <span className="text-gray-700 font-semibold truncate max-w-[80px]">{bus.next_stop || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Buffer</span>
                <span className={`font-semibold ${bus.buffer_size > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                  {bus.buffer_size ?? 0} pings
                </span>
              </div>
            </div>

            {/* 3D button */}
            {onSelectBus && (
              <button
                onClick={() => onSelectBus(busId)}
                disabled={isSelected}
                className={`w-full mt-1 py-1.5 text-[10px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-100 text-indigo-400 border border-indigo-200 cursor-default'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                }`}
              >
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
