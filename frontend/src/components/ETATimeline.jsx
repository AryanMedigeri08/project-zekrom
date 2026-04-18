/**
 * ETATimeline — Phase 5: Full rewrite with proper SVG cone, per-bus tabs.
 *
 * viewBox 0 0 800 160
 * Row 1 (y=35): Stop dots on a line, bus icon at current progress
 * Row 2 (y=100): Confidence cone trapezoid
 * Below SVG: arrival info row
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

const API_BASE = 'http://localhost:8000';

const BUS_TABS = [
  { id: 'bus_01', label: 'MIT-01', color: '#a855f7' },
  { id: 'bus_02', label: 'HIN-02', color: '#14b8a6' },
  { id: 'bus_03', label: 'HAD-03', color: '#f97316' },
  { id: 'bus_04', label: 'KAT-04', color: '#ef4444' },
  { id: 'bus_05', label: 'PUN-05', color: '#f59e0b' },
];

function getConeColor(width) {
  if (width === 'narrow') return '#22c55e';
  if (width === 'medium') return '#eab308';
  return '#ef4444';
}

export default function ETATimeline({ buses, routes, simConfig }) {
  const [activeBusId, setActiveBusId] = useState('bus_01');
  const [etaData, setEtaData] = useState(null);
  const [tripStatus, setTripStatus] = useState(null);

  const bus = buses?.[activeBusId];
  const route = routes?.[bus?.route_id];
  const stops = useMemo(() => route?.stops || [], [route]);
  const totalStops = stops.length;

  const fetchData = useCallback(async () => {
    try {
      const tripResp = await fetch(`${API_BASE}/api/trip-status?bus_id=${activeBusId}`);
      if (!tripResp.ok) return;
      const tsMap = await tripResp.json();
      const ts = tsMap[activeBusId];
      if (ts) setTripStatus(ts);

      const cfg = simConfig?.config || {};
      const etaResp = await fetch(`${API_BASE}/api/predict-eta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure_time: new Date().getHours(),
          day_of_week: (new Date().getDay() + 6) % 7,
          traffic_level: cfg.traffic_level ?? 1,
          avg_signal_strength: bus?.signal_strength ?? 85,
          weather: cfg.weather ?? 0,
          num_passengers_approx: 35,
          elapsed_minutes: ts?.elapsed_minutes || 0,
          current_stop_index: ts?.current_stop_index || bus?.stop_index || 0,
          bus_id: activeBusId,
        }),
      });
      if (etaResp.ok) setEtaData(await etaResp.json());
    } catch { /* */ }
  }, [activeBusId, bus?.signal_strength, simConfig?.config]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 8000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // SVG layout
  const W = 800, H = 160;
  const TL = 30, TR = W - 30;
  const TW = TR - TL;
  const ROW1_Y = 38;
  const ROW2_Y = 105;

  const progress = tripStatus?.route_progress ?? bus?.route_progress ?? 0;
  const busX = TL + TW * Math.min(1, Math.max(0, progress));

  // Cone
  const coneW = etaData?.confidence_width ?? 'narrow';
  const predicted = etaData?.predicted_remaining_minutes ?? 15;
  const marginMin = etaData?.confidence_margin_minutes ?? predicted * 0.15;
  const coneHalfWidth = Math.min(55, Math.max(20, marginMin * 3.5));
  const coneColor = getConeColor(coneW);

  const destX = TR;
  const conePath = `M ${busX} ${ROW2_Y} L ${destX} ${ROW2_Y - coneHalfWidth} L ${destX} ${ROW2_Y + coneHalfWidth} Z`;

  // Stop positions
  const stopXs = stops.map((_, i) => TL + TW * (totalStops > 1 ? i / (totalStops - 1) : 0));

  // Active tab color
  const activeTab = BUS_TABS.find(t => t.id === activeBusId);
  const tabColor = activeTab?.color || '#6366f1';

  const arrival = etaData?.predicted_arrival_time ?? '--:--';
  const rangeLo = etaData?.arrival_range_low ?? '--:--';
  const rangeHi = etaData?.arrival_range_high ?? '--:--';
  const penaltyApplied = etaData?.signal_penalty_applied ?? false;

  return (
    <div className="card-panel p-3 flex flex-col gap-2 h-full">
      {/* Bus selector tabs */}
      <div className="flex items-center gap-1 pb-1.5 border-b border-gray-100">
        {BUS_TABS.map((tab) => {
          const isActive = tab.id === activeBusId;
          return (
            <button key={tab.id} onClick={() => setActiveBusId(tab.id)}
              className="px-2 py-1 rounded-md text-[9px] font-bold border transition-all"
              style={isActive
                ? { borderColor: tab.color, backgroundColor: `${tab.color}15`, color: tab.color }
                : { borderColor: '#e2e8f0', backgroundColor: 'white', color: '#94a3b8' }
              }>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SVG Timeline */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 overflow-hidden" style={{ minHeight: '130px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet" style={{ minHeight: '130px' }}>
          {/* Route line */}
          <line x1={TL} y1={ROW1_Y} x2={TR} y2={ROW1_Y} stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
          {/* Traveled portion */}
          <line x1={TL} y1={ROW1_Y} x2={busX} y2={ROW1_Y} stroke={tabColor} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.6" />

          {/* Stop dots */}
          {stopXs.map((x, i) => {
            const isPassed = x <= busX;
            const isTerminal = i === 0 || i === totalStops - 1;
            return (
              <g key={i}>
                <circle cx={x} cy={ROW1_Y} r={isTerminal ? 6 : 4}
                  fill={isPassed ? tabColor : '#e2e8f0'}
                  stroke={isPassed ? tabColor : '#cbd5e1'} strokeWidth="1.5" />
                {/* Labels for first and last */}
                {i === 0 && (
                  <text x={x} y={ROW1_Y + 18} textAnchor="start" fill="#64748b" fontSize="8" fontWeight="500">
                    {stops[0]?.name?.split(' ').slice(0, 2).join(' ')}
                  </text>
                )}
                {i === totalStops - 1 && (
                  <text x={x} y={ROW1_Y + 18} textAnchor="end" fill="#6366f1" fontSize="8" fontWeight="700">
                    MITAOE
                  </text>
                )}
              </g>
            );
          })}

          {/* Bus icon at current position */}
          <g transform={`translate(${busX - 10}, ${ROW1_Y - 16})`}>
            <rect x="0" y="0" width="20" height="14" rx="3" fill={tabColor} />
            <rect x="2" y="2" width="5" height="4" rx="1" fill="white" opacity="0.8" />
            <rect x="8" y="2" width="5" height="4" rx="1" fill="white" opacity="0.8" />
            <rect x="14" y="2" width="4" height="4" rx="1" fill="white" opacity="0.8" />
            <circle cx="5" cy="15" r="2" fill="#374151" />
            <circle cx="15" cy="15" r="2" fill="#374151" />
          </g>

          {/* Confidence cone */}
          {busX < TR - 5 && (
            <path d={conePath} fill={coneColor} fillOpacity="0.2" stroke={coneColor} strokeWidth="1" strokeOpacity="0.5" />
          )}

          {/* Traveled bar (row 2) */}
          <rect x={TL} y={ROW2_Y - 4} width={Math.max(0, busX - TL)} height={8} rx={4} fill={tabColor} fillOpacity="0.35" />

          {/* Min/Max labels at destination edge */}
          {busX < TR - 5 && (
            <>
              <text x={destX + 4} y={ROW2_Y - coneHalfWidth + 4} fill={coneColor} fontSize="8" fontWeight="600">{rangeLo}</text>
              <text x={destX + 4} y={ROW2_Y + coneHalfWidth + 4} fill={coneColor} fontSize="8" fontWeight="600">{rangeHi}</text>
            </>
          )}

          {/* Progress text */}
          <text x={W / 2} y={H - 8} textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="500">
            Stop {(bus?.stop_index ?? 0) + 1}/{totalStops} — {(progress * 100).toFixed(0)}% complete
          </text>
        </svg>
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Estimated Arrival:</span>
          <span className="font-extrabold text-gray-800 tabular-nums">{arrival}</span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Range:</span>
          <span className="font-semibold text-gray-600 tabular-nums">{rangeLo} – {rangeHi}</span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Confidence:</span>
          <span className="font-bold" style={{ color: coneColor }}>{coneW}</span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Signal Penalty:</span>
          <span className={`font-semibold ${penaltyApplied ? 'text-red-500' : 'text-gray-400'}`}>
            {penaltyApplied ? 'Applied' : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
}
