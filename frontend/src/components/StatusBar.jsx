/**
 * StatusBar — System state display and signal strength control.
 *
 * Shows:
 *   • Current signal strength with a draggable slider (for demo control)
 *   • Ping interval at current signal tier
 *   • Last ping received timestamp
 *   • Buffer size (pings stored offline)
 *   • Connection status indicator
 *   • Bus speed and route progress
 */

import React, { useState, useCallback } from 'react';

export default function StatusBar({
  signalStrength,
  bufferSize,
  lastPingTime,
  busPosition,
  isConnected,
}) {
  const [sliderValue, setSliderValue] = useState(signalStrength);
  const [isUpdating, setIsUpdating] = useState(false);

  // Determine the ping interval label for the current signal tier
  const pingIntervalLabel =
    signalStrength >= 70
      ? '2s'
      : signalStrength >= 40
      ? '6s'
      : signalStrength >= 10
      ? '12s'
      : 'Buffering';

  // Format the last ping time for display
  const formattedPingTime = lastPingTime
    ? new Date(lastPingTime).toLocaleTimeString()
    : '—';

  // Signal strength colour
  const signalColor =
    signalStrength >= 70
      ? 'text-accent-cyan'
      : signalStrength >= 40
      ? 'text-accent-orange'
      : signalStrength >= 10
      ? 'text-accent-orange'
      : 'text-accent-red';

  // Slider background gradient
  const sliderBg =
    sliderValue >= 70
      ? 'bg-gradient-to-r from-accent-cyan/30 to-accent-cyan/60'
      : sliderValue >= 40
      ? 'bg-gradient-to-r from-accent-orange/30 to-accent-orange/60'
      : sliderValue >= 10
      ? 'bg-gradient-to-r from-accent-orange/30 to-accent-red/60'
      : 'bg-gradient-to-r from-accent-red/30 to-accent-red/60';

  // Send signal update to backend
  const updateSignal = useCallback(async (value) => {
    setIsUpdating(true);
    try {
      await fetch('http://localhost:8000/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strength: value }),
      });
    } catch (err) {
      console.warn('Failed to update signal:', err);
    }
    setIsUpdating(false);
  }, []);

  const handleSliderChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setSliderValue(val);
  };

  const handleSliderRelease = () => {
    updateSignal(sliderValue);
  };

  // Quick-set buttons for common test scenarios
  const presets = [
    { label: 'Full', value: 95, color: 'border-accent-cyan/40 hover:bg-accent-cyan/10' },
    { label: 'Good', value: 55, color: 'border-accent-blue/40 hover:bg-accent-blue/10' },
    { label: 'Poor', value: 25, color: 'border-accent-orange/40 hover:bg-accent-orange/10' },
    { label: 'Dead', value: 0, color: 'border-accent-red/40 hover:bg-accent-red/10' },
  ];

  return (
    <div className="glass-panel p-4 flex flex-col gap-4">
      {/* Title Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-accent-cyan"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
            />
          </svg>
          <h3 className="text-sm font-semibold text-gray-200 tracking-wide">
            System Control
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-accent-cyan' : 'bg-accent-red'
            }`}
          />
          <span className="text-[10px] font-medium text-gray-500 tracking-wide">
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* Signal Strength Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 font-medium">
            Signal Strength
          </span>
          <span className={`text-sm font-bold tabular-nums ${signalColor}`}>
            {sliderValue}%
          </span>
        </div>
        <input
          id="signal-slider"
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleSliderChange}
          onMouseUp={handleSliderRelease}
          onTouchEnd={handleSliderRelease}
          className={`w-full h-1.5 rounded-full cursor-pointer ${sliderBg}`}
        />
        {/* Preset buttons */}
        <div className="flex gap-2 mt-1">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setSliderValue(p.value);
                updateSignal(p.value);
              }}
              className={`flex-1 text-[10px] font-semibold py-1 rounded-md border transition-colors duration-200 ${p.color} text-gray-300`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Ping Interval */}
        <MetricCard
          label="Ping Interval"
          value={pingIntervalLabel}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color={signalStrength >= 10 ? 'text-accent-blue' : 'text-accent-red'}
        />

        {/* Buffer Size */}
        <MetricCard
          label="Buffer Size"
          value={`${bufferSize} pings`}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          }
          color={bufferSize > 0 ? 'text-accent-orange' : 'text-gray-500'}
        />

        {/* Last Ping */}
        <MetricCard
          label="Last Ping"
          value={formattedPingTime}
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h-.75A2.25 2.25 0 004.5 9.75v7.5a2.25 2.25 0 002.25 2.25h7.5a2.25 2.25 0 002.25-2.25v-7.5a2.25 2.25 0 00-2.25-2.25h-.75m-6 3.75l3 3m0 0l3-3m-3 3V1.5m6 9h.75a2.25 2.25 0 012.25 2.25v7.5a2.25 2.25 0 01-2.25 2.25h-7.5a2.25 2.25 0 01-2.25-2.25v-7.5a2.25 2.25 0 012.25-2.25H9" />
            </svg>
          }
          color="text-gray-400"
        />

        {/* Bus Speed */}
        <MetricCard
          label="Bus Speed"
          value={
            busPosition?.speed_kmh != null
              ? `${busPosition.speed_kmh.toFixed(1)} km/h`
              : '— km/h'
          }
          icon={
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          }
          color="text-accent-purple"
        />
      </div>

      {/* Current Location */}
      {busPosition?.current_stop && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800/60 border border-surface-600/40">
          <span className="text-base">📍</span>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 font-medium">
              Current Location
            </span>
            <span className="text-xs text-gray-200 font-semibold">
              {busPosition.current_stop}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Reusable metric card sub-component
// -----------------------------------------------------------------
function MetricCard({ label, value, icon, color }) {
  return (
    <div className="flex flex-col gap-1 p-2.5 rounded-lg bg-surface-800/40 border border-surface-600/30">
      <div className="flex items-center gap-1.5">
        <span className={`${color} opacity-60`}>{icon}</span>
        <span className="text-[10px] text-gray-500 font-medium tracking-wide">
          {label}
        </span>
      </div>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
