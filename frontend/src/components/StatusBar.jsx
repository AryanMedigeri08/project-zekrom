/**
 * StatusBar — Multi-bus system state (light mode).
 */

import React, { useState, useCallback } from 'react';

const ClockIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const SlidersIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
);

export default function StatusBar({ buses, isConnected }) {
  const busEntries = Object.entries(buses || {}).sort((a, b) => a[0].localeCompare(b[0]));

  // Signal controls — apply to all buses
  const [sliderValue, setSliderValue] = useState(85);

  const updateSignal = useCallback(async (value) => {
    try {
      await fetch('http://localhost:8000/api/sim-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal_strength: value }),
      });
    } catch { /* */ }
  }, []);

  const handleRelease = () => updateSignal(sliderValue);

  const presets = [
    { label: 'Full', value: 95, cls: 'border-teal-300 hover:bg-teal-50 text-teal-700' },
    { label: 'Good', value: 55, cls: 'border-blue-300 hover:bg-blue-50 text-blue-700' },
    { label: 'Poor', value: 25, cls: 'border-orange-300 hover:bg-orange-50 text-orange-700' },
    { label: 'Dead', value: 0, cls: 'border-red-300 hover:bg-red-50 text-red-700' },
  ];

  // Aggregate stats
  const totalBuffered = busEntries.reduce((sum, [, b]) => sum + (b.buffer_size || 0), 0);
  const ghostCount = busEntries.filter(([, b]) => b.is_ghost).length;

  return (
    <div className="card-panel p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-teal-600"><SlidersIcon /></span>
          <h3 className="text-xs font-semibold text-gray-700">System Control</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-teal-500' : 'bg-red-500'}`} />
          <span className="text-[9px] font-medium text-gray-400">{isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
        </div>
      </div>

      {/* Global signal slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-medium">All Buses Signal</span>
          <span className="text-xs font-bold tabular-nums text-teal-600">{sliderValue}%</span>
        </div>
        <input type="range" min="0" max="100" value={sliderValue}
          onChange={(e) => setSliderValue(parseInt(e.target.value, 10))}
          onMouseUp={handleRelease} onTouchEnd={handleRelease} className="w-full" />
        <div className="flex gap-1.5">
          {presets.map((p) => (
            <button key={p.label} onClick={() => { setSliderValue(p.value); updateSignal(p.value); }}
              className={`flex-1 text-[9px] font-semibold py-1 rounded-md border transition-colors ${p.cls}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fleet summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col p-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-[9px] text-gray-400">Active Buses</span>
          <span className="text-xs font-bold text-teal-600">{busEntries.length - ghostCount} / {busEntries.length}</span>
        </div>
        <div className="flex flex-col p-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-[9px] text-gray-400">Buffered</span>
          <span className={`text-xs font-bold ${totalBuffered > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{totalBuffered} pings</span>
        </div>
        <div className="flex flex-col p-2 rounded-lg bg-gray-50 border border-gray-100">
          <span className="text-[9px] text-gray-400">Ghost Mode</span>
          <span className={`text-xs font-bold ${ghostCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{ghostCount} buses</span>
        </div>
      </div>
    </div>
  );
}
