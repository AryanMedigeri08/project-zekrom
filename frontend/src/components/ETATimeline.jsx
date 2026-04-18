/**
 * ETATimeline — Compact horizontal route timeline with SVG confidence cone.
 * Light mode, no emojis, smaller form factor.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

const API_BASE = 'http://localhost:8000';

// SVG Icons
const ClockIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function ETATimeline({ signalStrength, simConfig, route, compact = false }) {
  const [etaData, setEtaData] = useState(null);
  const [tripStatus, setTripStatus] = useState(null);

  const stops = useMemo(() => (route || []).filter((wp) => wp.is_stop), [route]);
  const totalStops = stops.length;

  const fetchData = useCallback(async () => {
    try {
      const tripResp = await fetch(`${API_BASE}/api/trip-status`);
      if (!tripResp.ok) return;
      const ts = await tripResp.json();
      setTripStatus(ts);

      const config = simConfig?.config || {};
      const etaResp = await fetch(`${API_BASE}/api/predict-eta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure_time: new Date().getHours(),
          day_of_week: (new Date().getDay() + 6) % 7,
          traffic_level: config.traffic_level ?? 1,
          avg_signal_strength: config.signal_strength ?? signalStrength ?? 85,
          weather: config.weather ?? 0,
          num_passengers_approx: 35,
          elapsed_minutes: ts.elapsed_minutes || 0,
          current_stop_index: ts.current_stop_index || 0,
        }),
      });
      if (etaResp.ok) setEtaData(await etaResp.json());
    } catch { /* ignore */ }
  }, [signalStrength, simConfig?.config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Layout
  const SVG_WIDTH = compact ? 340 : 700;
  const SVG_HEIGHT = compact ? 60 : 70;
  const TRACK_Y = compact ? 28 : 32;
  const TRACK_LEFT = 24;
  const TRACK_RIGHT = SVG_WIDTH - 24;
  const TRACK_WIDTH = TRACK_RIGHT - TRACK_LEFT;

  const progress = tripStatus?.route_progress ?? 0;
  const busX = TRACK_LEFT + TRACK_WIDTH * Math.min(1, Math.max(0, progress));

  const coneWidth = etaData?.confidence_width ?? 'narrow';
  const predicted = etaData?.predicted_remaining_minutes ?? 15;
  const marginPct = coneWidth === 'narrow' ? 0.15 : coneWidth === 'medium' ? 0.25 : 0.40;
  const marginMin = +(predicted * marginPct).toFixed(1);
  const coneSpread = coneWidth === 'narrow' ? 8 : coneWidth === 'medium' ? 15 : 24;

  const coneColor = coneWidth === 'narrow'
    ? { fill: 'rgba(13,148,136,0.1)', stroke: 'rgba(13,148,136,0.4)' }
    : coneWidth === 'medium'
    ? { fill: 'rgba(234,88,12,0.1)', stroke: 'rgba(234,88,12,0.4)' }
    : { fill: 'rgba(220,38,38,0.1)', stroke: 'rgba(220,38,38,0.4)' };

  const arrivalTime = etaData?.predicted_arrival_time ?? '--:--';

  const stopPositions = stops.map((_, i) => {
    const frac = totalStops > 1 ? i / (totalStops - 1) : 0;
    return TRACK_LEFT + TRACK_WIDTH * frac;
  });

  const badgeColor = coneWidth === 'narrow'
    ? 'bg-teal-50 text-teal-700 border-teal-200'
    : coneWidth === 'medium'
    ? 'bg-orange-50 text-orange-700 border-orange-200'
    : 'bg-red-50 text-red-700 border-red-200';

  return (
    <div className="card-panel p-3 flex flex-col gap-2 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-500"><ClockIcon className="w-3.5 h-3.5" /></span>
          <h3 className="text-[11px] font-semibold text-gray-700">ETA Timeline</h3>
        </div>
        <div className="flex items-center gap-2">
          {tripStatus && (
            <span className="text-[9px] text-gray-400 font-mono">
              {tripStatus.distance_covered_km}/{tripStatus.total_route_km} km
            </span>
          )}
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border tracking-wider uppercase ${badgeColor}`}>
            {coneWidth}
          </span>
        </div>
      </div>

      {/* SVG timeline */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
        <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full" style={{ height: compact ? '56px' : '64px' }} preserveAspectRatio="xMidYMid meet">
          {/* Track bg */}
          <line x1={TRACK_LEFT} y1={TRACK_Y} x2={TRACK_RIGHT} y2={TRACK_Y} stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
          {/* Completed */}
          <line x1={TRACK_LEFT} y1={TRACK_Y} x2={busX} y2={TRACK_Y} stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.6" />

          {/* Cone */}
          {busX < TRACK_RIGHT - 5 && (
            <polygon
              points={`${busX},${TRACK_Y} ${TRACK_RIGHT},${TRACK_Y - coneSpread} ${TRACK_RIGHT},${TRACK_Y + coneSpread}`}
              fill={coneColor.fill} stroke={coneColor.stroke} strokeWidth="0.8"
              style={{ transition: 'all 0.8s ease-out' }}
            />
          )}

          {/* Stop dots */}
          {stopPositions.map((x, i) => (
            <circle key={i} cx={x} cy={TRACK_Y} r={i === 0 || i === totalStops - 1 ? 4.5 : 3}
              fill={x <= busX ? '#0d9488' : '#e2e8f0'} stroke={x <= busX ? '#0d9488' : '#cbd5e1'} strokeWidth="1.5" />
          ))}

          {/* Bus dot */}
          <circle cx={busX} cy={TRACK_Y} r="6" fill="#0d9488" stroke="#fff" strokeWidth="2" />
          <text x={busX} y={TRACK_Y + 2.5} textAnchor="middle" fill="#fff" fontSize="5" fontWeight="800">B</text>

          {/* First/last labels */}
          {!compact && (
            <>
              <text x={TRACK_LEFT} y={TRACK_Y + 18} textAnchor="start" fill="#64748b" fontSize="7" fontWeight="500">
                {stops[0]?.name?.split(' ').slice(0, 2).join(' ') ?? 'Start'}
              </text>
              <text x={TRACK_RIGHT} y={TRACK_Y + 18} textAnchor="end" fill="#64748b" fontSize="7" fontWeight="500">
                {stops[totalStops - 1]?.name?.replace('MIT Academy of Engineering', 'MIT AOE') ?? 'End'}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Arrival + info */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-gray-400 font-medium">Arrival:</span>
          <span className="text-sm font-extrabold text-gray-800 tabular-nums">{arrivalTime}</span>
          <span className={`text-[10px] font-semibold ${
            coneWidth === 'narrow' ? 'text-teal-600' : coneWidth === 'medium' ? 'text-orange-600' : 'text-red-600'
          }`}>(±{marginMin} min)</span>
        </div>
        {tripStatus && !compact && (
          <div className="flex gap-3 text-[9px] text-gray-400">
            <span>Stop {tripStatus.current_stop_index + 1}/{totalStops}</span>
            <span>{tripStatus.current_speed_kmh} km/h</span>
          </div>
        )}
      </div>
    </div>
  );
}
