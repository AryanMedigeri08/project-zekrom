/**
 * NetworkPanel — Live signal-strength waveform using Recharts.
 *
 * Shows a sliding window of the last 30 signal-strength readings as a
 * smooth area chart. Visual behavior:
 *   • Strong signal  → tall, regular waveform in cyan
 *   • Degraded signal → flattening waveform in orange
 *   • Dead zone       → flatline with "SIGNAL LOST" overlay
 */

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

export default function NetworkPanel({ signalHistory, signalStrength }) {
  const isOffline = signalStrength < 10;
  const isDegraded = signalStrength < 40;

  // Determine the waveform color based on current signal quality
  const strokeColor = isOffline
    ? '#ef476f'
    : isDegraded
    ? '#ff9f1c'
    : '#06d6a0';

  const fillColor = isOffline
    ? 'rgba(239, 71, 111, 0.15)'
    : isDegraded
    ? 'rgba(255, 159, 28, 0.15)'
    : 'rgba(6, 214, 160, 0.15)';

  // Ensure we always have 30 data points (pad with zeros if needed)
  const chartData = useMemo(() => {
    const data = [...(signalHistory || [])];
    while (data.length < 30) {
      data.unshift({ time: '', value: 0, timestamp: 0 });
    }
    return data.slice(-30);
  }, [signalHistory]);

  // Signal quality label
  const qualityLabel = isOffline
    ? 'OFFLINE'
    : signalStrength >= 70
    ? 'EXCELLENT'
    : signalStrength >= 40
    ? 'GOOD'
    : 'POOR';

  const qualityColor = isOffline
    ? 'text-accent-red'
    : signalStrength >= 70
    ? 'text-accent-cyan'
    : signalStrength >= 40
    ? 'text-accent-orange'
    : 'text-accent-orange';

  return (
    <div className="glass-panel p-4 flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke={strokeColor}
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79"
            />
          </svg>
          <h3 className="text-sm font-semibold text-gray-200 tracking-wide">
            Network Health
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold tracking-widest ${qualityColor}`}>
            {qualityLabel}
          </span>
          <div
            className={`signal-dot ${
              isOffline ? 'offline' : isDegraded ? 'degraded' : 'online'
            }`}
          />
        </div>
      </div>

      {/* Signal Strength Display */}
      <div className="flex items-baseline gap-2">
        <span
          className="text-3xl font-extrabold tabular-nums"
          style={{ color: strokeColor }}
        >
          {signalStrength}
        </span>
        <span className="text-xs text-gray-500 font-medium">% signal</span>
      </div>

      {/* Waveform Chart */}
      <div className="relative flex-1 min-h-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="signalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(42, 52, 86, 0.4)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tick={false}
              axisLine={{ stroke: 'rgba(42, 52, 86, 0.6)' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#4a5580', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            {/* Threshold reference lines */}
            <ReferenceLine
              y={70}
              stroke="rgba(6, 214, 160, 0.2)"
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={40}
              stroke="rgba(255, 159, 28, 0.2)"
              strokeDasharray="4 4"
            />
            <ReferenceLine
              y={10}
              stroke="rgba(239, 71, 111, 0.3)"
              strokeDasharray="4 4"
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2}
              fill="url(#signalGradient)"
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* SIGNAL LOST overlay */}
        {isOffline && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-950/60 rounded-lg">
            <div className="flex flex-col items-center gap-1">
              <span className="text-accent-red font-extrabold text-lg tracking-[0.3em] animate-pulse">
                SIGNAL LOST
              </span>
              <span className="text-gray-500 text-xs font-medium">
                Pings are being buffered
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tier Legend */}
      <div className="flex justify-between text-[10px] font-mono text-gray-600 px-1 mt-1">
        <span className="text-accent-red/60">0-10% Dead</span>
        <span className="text-accent-orange/60">10-40% Poor</span>
        <span className="text-accent-orange/60">40-70% Good</span>
        <span className="text-accent-cyan/60">70-100% Excellent</span>
      </div>
    </div>
  );
}
