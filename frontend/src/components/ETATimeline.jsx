/**
 * ETATimeline.jsx — Professional Minimal Dashboard
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

const API_BASE = 'http://localhost:8000';

const BUS_TABS = [
  { id: 'bus_01', label: 'MIT-01', color: '#8b5cf6' },
  { id: 'bus_02', label: 'HIN-02', color: '#0ea5e9' },
  { id: 'bus_03', label: 'HAD-03', color: '#f59e0b' },
  { id: 'bus_04', label: 'KAT-04', color: '#e11d48' },
  { id: 'bus_05', label: 'PUN-05', color: '#10b981' },
];

function getConeColor(width) {
  if (width === 'narrow') return '#10b981';
  if (width === 'medium') return '#f59e0b';
  return '#e11d48';
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

  const W = 800, H = 160;
  const TL = 30, TR = W - 30, TW = TR - TL;
  const ROW1_Y = 38, ROW2_Y = 105;

  const progress = tripStatus?.route_progress ?? bus?.route_progress ?? 0;
  const busX = TL + TW * Math.min(1, Math.max(0, progress));

  const coneW = etaData?.confidence_width ?? 'narrow';
  const predicted = etaData?.predicted_remaining_minutes ?? 15;
  const marginMin = etaData?.confidence_margin_minutes ?? predicted * 0.15;
  const coneHalfWidth = Math.min(55, Math.max(20, marginMin * 3.5));
  const coneColor = getConeColor(coneW);
  const conePath = `M ${busX} ${ROW2_Y} L ${TR} ${ROW2_Y - coneHalfWidth} L ${TR} ${ROW2_Y + coneHalfWidth} Z`;

  const stopXs = stops.map((_, i) => TL + TW * (totalStops > 1 ? i / (totalStops - 1) : 0));
  const tabColor = BUS_TABS.find(t => t.id === activeBusId)?.color || '#6366f1';

  const arrival = etaData?.predicted_arrival_time ?? '--:--';
  const rangeLo = etaData?.arrival_range_low ?? '--:--';
  const rangeHi = etaData?.arrival_range_high ?? '--:--';
  const penaltyApplied = etaData?.signal_penalty_applied ?? false;

  const svgTextColor = '#64748b';
  const svgBgColor = 'rgba(255,255,255,0.4)';
  const lineColor = '#cbd5e1';

  return (
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
      {/* Bus tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        {BUS_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveBusId(tab.id)} style={{
            padding: '6px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            border: `1px solid ${tab.id === activeBusId ? tab.color : 'var(--color-border)'}`,
            background: tab.id === activeBusId ? `${tab.color}15` : 'rgba(255,255,255,0.5)',
            color: tab.id === activeBusId ? tab.color : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: tab.id === activeBusId ? 'none' : '0 1px 3px rgba(0,0,0,0.02)'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* SVG Timeline */}
      <div style={{ borderRadius: '10px', background: svgBgColor, border: `1px solid var(--color-border)`, overflow: 'hidden', minHeight: '130px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minHeight: '130px' }} preserveAspectRatio="xMidYMid meet">
          <line x1={TL} y1={ROW1_Y} x2={TR} y2={ROW1_Y} stroke={lineColor} strokeWidth="4" strokeLinecap="round" />
          <line x1={TL} y1={ROW1_Y} x2={busX} y2={ROW1_Y} stroke={tabColor} strokeWidth="4" strokeLinecap="round" />

          {stopXs.map((x, i) => {
            const isPassed = x <= busX;
            const isTerminal = i === 0 || i === totalStops - 1;
            return (
              <g key={i}>
                <circle cx={x} cy={ROW1_Y} r={isTerminal ? 6 : 4}
                  fill={isPassed ? tabColor : '#f8fafc'} stroke={isPassed ? tabColor : lineColor} strokeWidth="2" />
                {i === 0 && <text x={x} y={ROW1_Y + 18} textAnchor="start" fill={svgTextColor} fontSize="10" fontWeight="600">{(stops[0]?.name || '').split(' ').slice(0, 2).join(' ')}</text>}
                {i === totalStops - 1 && <text x={x} y={ROW1_Y + 18} textAnchor="end" fill={tabColor} fontSize="10" fontWeight="700">MITAOE</text>}
              </g>
            );
          })}

          <g transform={`translate(${busX - 12}, ${ROW1_Y - 18})`}>
            <rect x="0" y="0" width="24" height="16" rx="4" fill={tabColor} />
            <circle cx="6" cy="18" r="2.5" fill="#334155" /><circle cx="18" cy="18" r="2.5" fill="#334155" />
          </g>

          {busX < TR - 5 && <path d={conePath} fill={coneColor} fillOpacity="0.1" stroke={coneColor} strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="4 4" />}

          <rect x={TL} y={ROW2_Y - 4} width={Math.max(0, busX - TL)} height={8} rx={4} fill={tabColor} fillOpacity="0.2" />

          {busX < TR - 5 && (
            <>
              <text x={TR + 6} y={ROW2_Y - coneHalfWidth + 4} fill={coneColor} fontSize="10" fontWeight="600">{rangeLo}</text>
              <text x={TR + 6} y={ROW2_Y + coneHalfWidth + 4} fill={coneColor} fontSize="10" fontWeight="600">{rangeHi}</text>
            </>
          )}

          <text x={W / 2} y={H - 6} textAnchor="middle" fill={svgTextColor} fontSize="10" fontWeight="600">
            Stop {(bus?.stop_index ?? 0) + 1}/{totalStops} — {(progress * 100).toFixed(0)}% complete
          </text>
        </svg>
      </div>

      {/* Info row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '13px', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>ETA</span>
          <span style={{ fontWeight: 800, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums', fontSize: '16px' }}>{arrival}</span>
        </div>
        <span style={{ color: 'var(--color-border-darker)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '12px' }}>Range:</span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{rangeLo} – {rangeHi}</span>
        </div>
        <span style={{ color: 'var(--color-border-darker)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '12px' }}>Confidence:</span>
          <span style={{ fontWeight: 700, color: coneColor }}>{coneW.toUpperCase()}</span>
        </div>
        <span style={{ color: 'var(--color-border-darker)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)', fontWeight: 500, fontSize: '12px' }}>Penalty:</span>
          <span style={{ fontWeight: 600, color: penaltyApplied ? '#ef4444' : 'var(--color-text-muted)' }}>
            {penaltyApplied ? 'Applied' : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
}
