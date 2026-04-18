/**
 * NetworkPanel — Signal strength waveform (light mode, no emojis).
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

// SVG Icons
const SignalIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79" />
  </svg>
);

export default function NetworkPanel({ signalHistory, signalStrength }) {
  const isOffline = signalStrength < 10;
  const isDegraded = signalStrength < 40;

  const strokeColor = isOffline ? '#dc2626' : isDegraded ? '#ea580c' : '#0d9488';

  const chartData = useMemo(() => {
    const data = [...(signalHistory || [])];
    while (data.length < 30) {
      data.unshift({ time: '', value: 0, timestamp: 0 });
    }
    return data.slice(-30);
  }, [signalHistory]);

  const qualityLabel = isOffline
    ? 'OFFLINE' : signalStrength >= 70
    ? 'EXCELLENT' : signalStrength >= 40
    ? 'GOOD' : 'POOR';

  const qualityColor = isOffline
    ? 'text-red-600' : signalStrength >= 70
    ? 'text-teal-600' : 'text-orange-600';

  return (
    <div className="card-panel p-4 flex flex-col gap-2.5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={isOffline ? 'text-red-500' : isDegraded ? 'text-orange-500' : 'text-teal-600'}>
            <SignalIcon />
          </span>
          <h3 className="text-xs font-semibold text-gray-700 tracking-wide">Network Health</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold tracking-widest ${qualityColor}`}>
            {qualityLabel}
          </span>
          <div className={`signal-dot ${isOffline ? 'offline' : isDegraded ? 'degraded' : 'online'}`} />
        </div>
      </div>

      {/* Signal value */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold tabular-nums" style={{ color: strokeColor }}>
          {signalStrength}
        </span>
        <span className="text-[10px] text-gray-400 font-medium">% signal</span>
      </div>

      {/* Chart */}
      <div className="relative flex-1 min-h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id="signalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.6)" vertical={false} />
            <XAxis dataKey="time" tick={false} axisLine={{ stroke: '#e2e8f0' }} />
            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={70} stroke="rgba(13,148,136,0.15)" strokeDasharray="4 4" />
            <ReferenceLine y={40} stroke="rgba(234,88,12,0.15)" strokeDasharray="4 4" />
            <ReferenceLine y={10} stroke="rgba(220,38,38,0.2)" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="value" stroke={strokeColor} strokeWidth={2}
              fill="url(#signalGradient)" isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>

        {/* SIGNAL LOST overlay */}
        {isOffline && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-red-600 font-extrabold text-sm tracking-[0.2em] animate-pulse">SIGNAL LOST</span>
              <span className="text-gray-400 text-[10px]">Pings are being buffered</span>
            </div>
          </div>
        )}
      </div>

      {/* Tier legend */}
      <div className="flex justify-between text-[9px] font-mono text-gray-400 px-0.5">
        <span className="text-red-400">0-10% Dead</span>
        <span className="text-orange-400">10-40% Poor</span>
        <span className="text-orange-400">40-70% Good</span>
        <span className="text-teal-500">70-100% Excellent</span>
      </div>
    </div>
  );
}
