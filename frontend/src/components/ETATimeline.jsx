/**
 * ETATimeline — Horizontal route timeline with SVG confidence cone.
 *
 * Visual elements:
 *   • Horizontal bar representing the full route
 *   • Named departure (left) and destination (right) labels
 *   • Intermediate stop dots along the bar
 *   • Bus icon at current position
 *   • Expanding SVG cone from bus → destination showing ETA confidence
 *   • Arrival estimate with ± margin below the timeline
 *   • Legend explaining what the cone represents
 *
 * The cone smoothly animates width changes when signal strength changes.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

const API_BASE = 'http://localhost:8000';

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export default function ETATimeline({ signalStrength, simConfig, route }) {
  const [etaData, setEtaData] = useState(null);
  const [tripStatus, setTripStatus] = useState(null);
  const prevConeRef = useRef({ low: 0, high: 0 });

  // Extract stops from route
  const stops = useMemo(
    () => (route || []).filter((wp) => wp.is_stop),
    [route]
  );
  const totalStops = stops.length;

  // ──────────────────────────────────────────────────────────────────
  // Poll /api/trip-status and /api/predict-eta every 10 seconds
  // ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      // Trip status
      const tripResp = await fetch(`${API_BASE}/api/trip-status`);
      if (tripResp.ok) {
        const ts = await tripResp.json();
        setTripStatus(ts);

        // ETA prediction
        const config = simConfig?.config || {};
        const etaResp = await fetch(`${API_BASE}/api/predict-eta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            departure_time: new Date().getHours(),
            day_of_week: (new Date().getDay() + 6) % 7, // JS Sunday=0 → Mon=0
            traffic_level: config.traffic_level ?? 1,
            avg_signal_strength: config.signal_strength ?? signalStrength ?? 85,
            weather: config.weather ?? 0,
            num_passengers_approx: 35,
            elapsed_minutes: ts.elapsed_minutes || 0,
            current_stop_index: ts.current_stop_index || 0,
          }),
        });
        if (etaResp.ok) {
          setEtaData(await etaResp.json());
        }
      }
    } catch (err) {
      console.warn('[ETATimeline] fetch error:', err);
    }
  }, [signalStrength, simConfig?.config]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ──────────────────────────────────────────────────────────────────
  // Layout calculations
  // ──────────────────────────────────────────────────────────────────
  const SVG_WIDTH = 720;
  const SVG_HEIGHT = 100;
  const TRACK_Y = 45;
  const TRACK_LEFT = 40;
  const TRACK_RIGHT = SVG_WIDTH - 40;
  const TRACK_WIDTH = TRACK_RIGHT - TRACK_LEFT;

  // Bus position on the timeline (0–1 progress)
  const progress = tripStatus?.route_progress ?? 0;
  const busX = TRACK_LEFT + TRACK_WIDTH * Math.min(1, Math.max(0, progress));

  // Confidence cone
  const coneWidth = etaData?.confidence_width ?? 'narrow';
  const marginPct = coneWidth === 'narrow' ? 0.15 : coneWidth === 'medium' ? 0.25 : 0.40;
  const predicted = etaData?.predicted_remaining_minutes ?? 15;
  const marginMin = +(predicted * marginPct).toFixed(1);

  // Cone geometry: starts narrow at bus, expands toward destination
  const coneStartY = TRACK_Y;
  const coneEndX = TRACK_RIGHT;
  // Spread proportional to confidence width (visual exaggeration for clarity)
  const coneSpread = coneWidth === 'narrow' ? 12 : coneWidth === 'medium' ? 22 : 35;

  // Cone colors
  const coneColor = coneWidth === 'narrow'
    ? { fill: 'rgba(6, 214, 160, 0.12)', stroke: 'rgba(6, 214, 160, 0.5)' }
    : coneWidth === 'medium'
    ? { fill: 'rgba(255, 159, 28, 0.12)', stroke: 'rgba(255, 159, 28, 0.5)' }
    : { fill: 'rgba(239, 71, 111, 0.12)', stroke: 'rgba(239, 71, 111, 0.5)' };

  // Arrival display
  const arrivalTime = etaData?.predicted_arrival_time ?? '--:--';
  const confLow = etaData?.confidence_low ?? 0;
  const confHigh = etaData?.confidence_high ?? 0;

  // Stop dots positions
  const stopPositions = stops.map((_, i) => {
    const frac = totalStops > 1 ? i / (totalStops - 1) : 0;
    return TRACK_LEFT + TRACK_WIDTH * frac;
  });

  return (
    <div className="glass-panel p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🕐</span>
          <h3 className="text-sm font-bold text-gray-200 tracking-wide">ETA Timeline</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 font-mono">
            {tripStatus ? `${tripStatus.distance_covered_km} / ${tripStatus.total_route_km} km` : '—'}
          </span>
          <ConeWidthBadge width={coneWidth} />
        </div>
      </div>

      {/* SVG Timeline */}
      <div className="relative w-full overflow-hidden rounded-lg bg-surface-800/30 border border-surface-600/20">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full"
          style={{ height: '100px' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Track background line */}
          <line
            x1={TRACK_LEFT} y1={TRACK_Y}
            x2={TRACK_RIGHT} y2={TRACK_Y}
            stroke="rgba(42, 52, 86, 0.8)"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Completed portion of track */}
          <line
            x1={TRACK_LEFT} y1={TRACK_Y}
            x2={busX} y2={TRACK_Y}
            stroke="rgba(6, 214, 160, 0.5)"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Confidence Cone (SVG polygon from bus to destination) */}
          {busX < TRACK_RIGHT - 5 && (
            <polygon
              points={`
                ${busX},${TRACK_Y}
                ${coneEndX},${TRACK_Y - coneSpread}
                ${coneEndX},${TRACK_Y + coneSpread}
              `}
              fill={coneColor.fill}
              stroke={coneColor.stroke}
              strokeWidth="1"
              style={{ transition: 'all 0.8s ease-out' }}
            />
          )}

          {/* Stop dots */}
          {stopPositions.map((x, i) => (
            <g key={i}>
              <circle
                cx={x} cy={TRACK_Y}
                r={i === 0 || i === totalStops - 1 ? 6 : 4}
                fill={x <= busX ? '#06d6a0' : '#2a3456'}
                stroke={x <= busX ? '#06d6a0' : '#4a5580'}
                strokeWidth="2"
              />
              {/* Stop labels (first, last, and every other) */}
              {(i === 0 || i === totalStops - 1 || i % 2 === 0) && (
                <text
                  x={x}
                  y={i % 2 === 0 ? TRACK_Y - 16 : TRACK_Y + 24}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="8"
                  fontWeight="500"
                  fontFamily="Inter, sans-serif"
                >
                  {stops[i]?.name?.replace('MIT Academy of Engineering', 'MIT AOE')
                    ?.split(' ').slice(0, 2).join(' ') ?? `Stop ${i + 1}`}
                </text>
              )}
            </g>
          ))}

          {/* Bus icon */}
          <g style={{ transition: 'transform 0.5s ease-out' }}>
            {/* Bus body */}
            <rect
              x={busX - 10} y={TRACK_Y - 8}
              width="20" height="16"
              rx="4"
              fill="#06d6a0"
              stroke="#fff"
              strokeWidth="1.5"
            />
            {/* Bus windows */}
            <rect x={busX - 6} y={TRACK_Y - 5} width="4" height="4" rx="1" fill="#0a0e1a" opacity="0.6" />
            <rect x={busX + 2} y={TRACK_Y - 5} width="4" height="4" rx="1" fill="#0a0e1a" opacity="0.6" />
            {/* Bus text */}
            <text
              x={busX} y={TRACK_Y + 5}
              textAnchor="middle" fill="#0a0e1a"
              fontSize="6" fontWeight="800"
            >
              BUS
            </text>
          </g>

          {/* Departure label */}
          <text
            x={TRACK_LEFT} y={TRACK_Y + 30}
            textAnchor="start" fill="#06d6a0"
            fontSize="9" fontWeight="600"
          >
            {stops[0]?.name?.split(' ').slice(0, 2).join(' ') ?? 'Start'}
          </text>

          {/* Destination label */}
          <text
            x={TRACK_RIGHT} y={TRACK_Y + 30}
            textAnchor="end" fill="#118ab2"
            fontSize="9" fontWeight="600"
          >
            {stops[totalStops - 1]?.name?.replace('MIT Academy of Engineering', 'MIT AOE') ?? 'End'}
          </text>
        </svg>
      </div>

      {/* Arrival Estimate + Legend Row */}
      <div className="flex items-center justify-between">
        {/* Arrival estimate */}
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-gray-500 font-medium">Estimated Arrival:</span>
          <span className="text-lg font-extrabold text-gray-100 tabular-nums">{arrivalTime}</span>
          <span className={`text-xs font-semibold ${
            coneWidth === 'narrow' ? 'text-accent-cyan' :
            coneWidth === 'medium' ? 'text-accent-orange' : 'text-accent-red'
          }`}>
            (±{marginMin} min)
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          <LegendItem color="#06d6a0" opacity="0.15" label="Narrow (high confidence)" />
          <LegendItem color="#ff9f1c" opacity="0.15" label="Medium" />
          <LegendItem color="#ef476f" opacity="0.15" label="Wide (low confidence)" />
        </div>
      </div>

      {/* Extra data row */}
      {tripStatus && (
        <div className="flex items-center justify-between text-[10px] text-gray-600 px-1">
          <span>Stop {tripStatus.current_stop_index + 1} of {totalStops}</span>
          <span>{tripStatus.stops_remaining} stops remaining</span>
          <span>{tripStatus.current_speed_kmh} km/h</span>
          <span>Elapsed: {tripStatus.elapsed_minutes} min</span>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════════

function ConeWidthBadge({ width }) {
  const styles = {
    narrow: 'bg-accent-cyan/15 text-accent-cyan border-accent-cyan/30',
    medium: 'bg-accent-orange/15 text-accent-orange border-accent-orange/30',
    wide: 'bg-accent-red/15 text-accent-red border-accent-red/30',
  };
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wider uppercase ${styles[width] || styles.narrow}`}>
      {width}
    </span>
  );
}

function LegendItem({ color, opacity, label }) {
  return (
    <div className="flex items-center gap-1">
      <div
        className="w-3 h-2 rounded-sm"
        style={{ background: color, opacity: parseFloat(opacity) + 0.3 }}
      />
      <span className="text-[8px] text-gray-600">{label}</span>
    </div>
  );
}
