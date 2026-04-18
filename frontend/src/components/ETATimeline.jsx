/**
 * ETATimeline.jsx — Phase 6: Themed, larger fonts, per-bus tabs.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  const svgTextColor = isDark ? '#cbd5e1' : '#64748b';
  const svgBgColor = isDark ? '#111' : '#f8fafc';
  const lineColor = isDark ? '#333' : '#e2e8f0';

  return (
    <div className="zk-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      {/* Bus tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingBottom: '6px', borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
        {BUS_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveBusId(tab.id)} style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
            border: `1px solid ${tab.id === activeBusId ? tab.color : 'var(--color-border)'}`,
            background: tab.id === activeBusId ? `${tab.color}18` : 'transparent',
            color: tab.id === activeBusId ? tab.color : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* SVG Timeline */}
      <div style={{ borderRadius: '8px', background: svgBgColor, border: `1px solid ${lineColor}`, overflow: 'hidden', minHeight: '130px' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minHeight: '130px' }} preserveAspectRatio="xMidYMid meet">
          <line x1={TL} y1={ROW1_Y} x2={TR} y2={ROW1_Y} stroke={lineColor} strokeWidth="3" strokeLinecap="round" />
          <line x1={TL} y1={ROW1_Y} x2={busX} y2={ROW1_Y} stroke={tabColor} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.6" />

          {stopXs.map((x, i) => {
            const isPassed = x <= busX;
            const isTerminal = i === 0 || i === totalStops - 1;
            return (
              <g key={i}>
                <circle cx={x} cy={ROW1_Y} r={isTerminal ? 6 : 4}
                  fill={isPassed ? tabColor : lineColor} stroke={isPassed ? tabColor : svgTextColor} strokeWidth="1.5" />
                {i === 0 && <text x={x} y={ROW1_Y + 18} textAnchor="start" fill={svgTextColor} fontSize="9" fontWeight="500">{(stops[0]?.name || '').split(' ').slice(0, 2).join(' ')}</text>}
                {i === totalStops - 1 && <text x={x} y={ROW1_Y + 18} textAnchor="end" fill="#6366f1" fontSize="9" fontWeight="700">MITAOE</text>}
              </g>
            );
          })}

          <g transform={`translate(${busX - 10}, ${ROW1_Y - 16})`}>
            <rect x="0" y="0" width="20" height="14" rx="3" fill={tabColor} />
            <rect x="2" y="2" width="5" height="4" rx="1" fill="white" opacity="0.8" />
            <rect x="8" y="2" width="5" height="4" rx="1" fill="white" opacity="0.8" />
            <rect x="14" y="2" width="4" height="4" rx="1" fill="white" opacity="0.8" />
            <circle cx="5" cy="15" r="2" fill="#374151" /><circle cx="15" cy="15" r="2" fill="#374151" />
          </g>

          {busX < TR - 5 && <path d={conePath} fill={coneColor} fillOpacity="0.2" stroke={coneColor} strokeWidth="1" strokeOpacity="0.5" />}

          <rect x={TL} y={ROW2_Y - 4} width={Math.max(0, busX - TL)} height={8} rx={4} fill={tabColor} fillOpacity="0.35" />

          {busX < TR - 5 && (
            <>
              <text x={TR + 4} y={ROW2_Y - coneHalfWidth + 4} fill={coneColor} fontSize="9" fontWeight="600">{rangeLo}</text>
              <text x={TR + 4} y={ROW2_Y + coneHalfWidth + 4} fill={coneColor} fontSize="9" fontWeight="600">{rangeHi}</text>
            </>
          )}

          <text x={W / 2} y={H - 6} textAnchor="middle" fill={svgTextColor} fontSize="9" fontWeight="500">
            Stop {(bus?.stop_index ?? 0) + 1}/{totalStops} — {(progress * 100).toFixed(0)}% complete
          </text>
        </svg>
      </div>

      {/* Info row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>ETA:</span>
          <span style={{ fontWeight: 800, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>{arrival}</span>
        </div>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Range:</span>
          <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{rangeLo} – {rangeHi}</span>
        </div>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Confidence:</span>
          <span style={{ fontWeight: 700, color: coneColor }}>{coneW}</span>
        </div>
        <span style={{ color: 'var(--color-border)' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Penalty:</span>
          <span style={{ fontWeight: 600, color: penaltyApplied ? '#ef4444' : 'var(--color-text-muted)' }}>
            {penaltyApplied ? 'Applied' : 'None'}
          </span>
        </div>
      </div>
    </div>
  );
}
