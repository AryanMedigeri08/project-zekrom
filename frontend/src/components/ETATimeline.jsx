/**
 * ETATimeline — Phase 3: Multi-bus aware, compact SVG confidence cone.
 *
 * When multiple buses exist, shows ETA for the first bus or the one
 * matching the simConfig's targetBusId.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

const API_BASE = 'http://localhost:8000';

const ClockIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function ETATimeline({ signalStrength, simConfig, routes, buses, compact = false }) {
  const [etaData, setEtaData] = useState(null);
  const [tripStatus, setTripStatus] = useState(null);

  // Pick the target bus
  const targetBusId = simConfig?.targetBusId || Object.keys(buses || {})[0] || 'bus_01';
  const targetBus = buses?.[targetBusId];
  const targetRoute = routes?.[targetBus?.route_id];

  const stops = useMemo(
    () => (targetRoute?.stops || []),
    [targetRoute]
  );
  const totalStops = stops.length;

  const fetchData = useCallback(async () => {
    try {
      const tripResp = await fetch(`${API_BASE}/api/trip-status?bus_id=${targetBusId}`);
      if (!tripResp.ok) return;
      const tsMap = await tripResp.json();
      const ts = tsMap[targetBusId];
      if (!ts) return;
      setTripStatus(ts);

      const cfg = simConfig?.config || {};
      const etaResp = await fetch(`${API_BASE}/api/predict-eta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure_time: new Date().getHours(),
          day_of_week: (new Date().getDay() + 6) % 7,
          traffic_level: cfg.traffic_level ?? 1,
          avg_signal_strength: cfg.signal_strength ?? signalStrength ?? 85,
          weather: cfg.weather ?? 0,
          num_passengers_approx: 35,
          elapsed_minutes: ts.elapsed_minutes || 0,
          current_stop_index: ts.current_stop_index || 0,
          bus_id: targetBusId,
        }),
      });
      if (etaResp.ok) setEtaData(await etaResp.json());
    } catch { /* */ }
  }, [targetBusId, signalStrength, simConfig?.config]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Layout
  const W = compact ? 340 : 700;
  const H = compact ? 56 : 66;
  const TY = compact ? 26 : 30;
  const TL = 24, TR = W - 24, TW = TR - TL;

  const progress = tripStatus?.route_progress ?? (targetBus?.route_progress ?? 0);
  const busX = TL + TW * Math.min(1, Math.max(0, progress));

  const coneW = etaData?.confidence_width ?? 'narrow';
  const predicted = etaData?.predicted_remaining_minutes ?? 15;
  const mPct = coneW === 'narrow' ? 0.15 : coneW === 'medium' ? 0.25 : 0.40;
  const mMin = +(predicted * mPct).toFixed(1);
  const spread = coneW === 'narrow' ? 8 : coneW === 'medium' ? 14 : 22;

  const coneCol = coneW === 'narrow'
    ? { fill: 'rgba(13,148,136,0.1)', stroke: 'rgba(13,148,136,0.4)' }
    : coneW === 'medium'
    ? { fill: 'rgba(234,88,12,0.1)', stroke: 'rgba(234,88,12,0.4)' }
    : { fill: 'rgba(220,38,38,0.1)', stroke: 'rgba(220,38,38,0.4)' };

  const arrival = etaData?.predicted_arrival_time ?? '--:--';
  const stopXs = stops.map((_, i) => TL + TW * (totalStops > 1 ? i / (totalStops - 1) : 0));

  const badgeCls = coneW === 'narrow' ? 'bg-teal-50 text-teal-700 border-teal-200'
    : coneW === 'medium' ? 'bg-orange-50 text-orange-700 border-orange-200'
    : 'bg-red-50 text-red-700 border-red-200';

  return (
    <div className="card-panel p-3 flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-500"><ClockIcon /></span>
          <h3 className="text-[11px] font-semibold text-gray-700">
            ETA — {targetBus?.label || targetBusId}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {tripStatus && (
            <span className="text-[9px] text-gray-400 font-mono">
              {tripStatus.distance_covered_km}/{tripStatus.total_route_km} km
            </span>
          )}
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border tracking-wider uppercase ${badgeCls}`}>
            {coneW}
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: compact ? '52px' : '60px' }} preserveAspectRatio="xMidYMid meet">
          <line x1={TL} y1={TY} x2={TR} y2={TY} stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
          <line x1={TL} y1={TY} x2={busX} y2={TY} stroke="#0d9488" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.6" />
          {busX < TR - 5 && (
            <polygon points={`${busX},${TY} ${TR},${TY - spread} ${TR},${TY + spread}`}
              fill={coneCol.fill} stroke={coneCol.stroke} strokeWidth="0.8" style={{ transition: 'all 0.8s ease-out' }} />
          )}
          {stopXs.map((x, i) => (
            <circle key={i} cx={x} cy={TY} r={i === 0 || i === totalStops - 1 ? 4.5 : 3}
              fill={x <= busX ? '#0d9488' : '#e2e8f0'} stroke={x <= busX ? '#0d9488' : '#cbd5e1'} strokeWidth="1.5" />
          ))}
          <circle cx={busX} cy={TY} r="6" fill="#0d9488" stroke="#fff" strokeWidth="2" />
          <text x={busX} y={TY + 2.5} textAnchor="middle" fill="#fff" fontSize="5" fontWeight="800">B</text>
          {!compact && stops.length > 0 && (
            <>
              <text x={TL} y={TY + 16} textAnchor="start" fill="#64748b" fontSize="7" fontWeight="500">
                {stops[0]?.name?.split(' ').slice(0, 2).join(' ')}
              </text>
              <text x={TR} y={TY + 16} textAnchor="end" fill="#64748b" fontSize="7" fontWeight="500">
                {stops[totalStops - 1]?.name?.split(' ').slice(0, 2).join(' ')}
              </text>
            </>
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[10px] text-gray-400">Arrival:</span>
          <span className="text-sm font-extrabold text-gray-800 tabular-nums">{arrival}</span>
          <span className={`text-[10px] font-semibold ${
            coneW === 'narrow' ? 'text-teal-600' : coneW === 'medium' ? 'text-orange-600' : 'text-red-600'
          }`}>(±{mMin} min)</span>
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
