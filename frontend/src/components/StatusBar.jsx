/**
 * StatusBar — System state display + signal control (light mode, no emojis).
 */

import React, { useState, useCallback } from 'react';

// SVG Icons
const ClockIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const BoxIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  </svg>
);
const BoltIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);
const PinIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);
const SlidersIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
);

export default function StatusBar({
  signalStrength,
  bufferSize,
  lastPingTime,
  busPosition,
  isConnected,
}) {
  const [sliderValue, setSliderValue] = useState(signalStrength);

  const pingIntervalLabel = signalStrength >= 70 ? '2s' : signalStrength >= 40 ? '6s' : signalStrength >= 10 ? '12s' : 'Buffering';
  const formattedPingTime = lastPingTime ? new Date(lastPingTime).toLocaleTimeString() : '—';
  const signalColor = signalStrength >= 70 ? 'text-teal-600' : signalStrength >= 40 ? 'text-orange-600' : 'text-red-600';

  const updateSignal = useCallback(async (value) => {
    try {
      await fetch('http://localhost:8000/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strength: value }),
      });
    } catch (err) { console.warn('Signal update failed:', err); }
  }, []);

  const handleSliderRelease = () => updateSignal(sliderValue);

  const presets = [
    { label: 'Full', value: 95, cls: 'border-teal-300 hover:bg-teal-50 text-teal-700' },
    { label: 'Good', value: 55, cls: 'border-blue-300 hover:bg-blue-50 text-blue-700' },
    { label: 'Poor', value: 25, cls: 'border-orange-300 hover:bg-orange-50 text-orange-700' },
    { label: 'Dead', value: 0, cls: 'border-red-300 hover:bg-red-50 text-red-700' },
  ];

  return (
    <div className="card-panel p-4 flex flex-col gap-3">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-teal-600"><SlidersIcon /></span>
          <h3 className="text-xs font-semibold text-gray-700 tracking-wide">System Control</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-teal-500' : 'bg-red-500'}`} />
          <span className="text-[9px] font-medium text-gray-400 tracking-wide">
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* Signal slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-medium">Signal Strength</span>
          <span className={`text-xs font-bold tabular-nums ${signalColor}`}>{sliderValue}%</span>
        </div>
        <input type="range" min="0" max="100" value={sliderValue}
          onChange={(e) => setSliderValue(parseInt(e.target.value, 10))}
          onMouseUp={handleSliderRelease} onTouchEnd={handleSliderRelease}
          className="w-full" />
        <div className="flex gap-1.5">
          {presets.map((p) => (
            <button key={p.label} onClick={() => { setSliderValue(p.value); updateSignal(p.value); }}
              className={`flex-1 text-[9px] font-semibold py-1 rounded-md border transition-colors ${p.cls}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Ping Interval" value={pingIntervalLabel} icon={<ClockIcon />}
          color={signalStrength >= 10 ? 'text-blue-600' : 'text-red-600'} />
        <MetricCard label="Buffer Size" value={`${bufferSize} pings`} icon={<BoxIcon />}
          color={bufferSize > 0 ? 'text-orange-600' : 'text-gray-400'} />
        <MetricCard label="Last Ping" value={formattedPingTime} icon={<ClockIcon />} color="text-gray-500" />
        <MetricCard label="Bus Speed" icon={<BoltIcon />} color="text-purple-600"
          value={busPosition?.speed_kmh != null ? `${busPosition.speed_kmh.toFixed(1)} km/h` : '—'} />
      </div>

      {/* Current location */}
      {busPosition?.current_stop && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
          <span className="text-blue-500"><PinIcon /></span>
          <div>
            <span className="text-[9px] text-gray-400 font-medium block">Current Location</span>
            <span className="text-xs text-gray-700 font-semibold">{busPosition.current_stop}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, color }) {
  return (
    <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-1">
        <span className={`${color} opacity-60`}>{icon}</span>
        <span className="text-[9px] text-gray-400 font-medium">{label}</span>
      </div>
      <span className={`text-xs font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
