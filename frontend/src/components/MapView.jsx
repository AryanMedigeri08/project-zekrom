/**
 * MapView — Phase 5: 5 routes, dead zones, bus SVG icons, MITAOE marker.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  MapContainer, TileLayer, Polyline, Marker, Tooltip, Popup, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import MapLegend from './MapLegend';

// ── Custom SVG bus icon ──
function createBusIcon(bus) {
  const signal = bus.signal_strength ?? 85;
  const color = signal > 70 ? '#22c55e'
    : signal > 40 ? '#eab308'
    : bus.is_ghost ? '#ffffff'
    : '#ef4444';

  const opacity = bus.is_ghost ? 0.5 : 1.0;
  const dashArray = bus.is_ghost ? '6,3' : 'none';
  const label = bus.label || bus.bus_id || '?';
  const confText = bus.is_ghost && bus.ghost_confidence
    ? `<text x="26" y="20" font-size="7" fill="white" text-anchor="middle" opacity="0.8">EST ${Math.round(bus.ghost_confidence * 100)}%</text>`
    : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
      <ellipse cx="26" cy="60" rx="12" ry="4" fill="rgba(0,0,0,0.3)"/>
      <path d="M26 0 C12 0 2 10 2 22 C2 38 26 58 26 58 C26 58 50 38 50 22 C50 10 40 0 26 0 Z"
            fill="#1e293b" stroke="${color}" stroke-width="3"
            stroke-dasharray="${dashArray}" opacity="${opacity}"/>
      <rect x="10" y="8" width="32" height="22" rx="4" fill="${color}" opacity="${opacity}"/>
      <rect x="13" y="11" width="8" height="6" rx="1" fill="#1e293b" opacity="0.8"/>
      <rect x="24" y="11" width="8" height="6" rx="1" fill="#1e293b" opacity="0.8"/>
      <rect x="35" y="11" width="5" height="6" rx="1" fill="#1e293b" opacity="0.8"/>
      <circle cx="16" cy="32" r="3" fill="#374151"/>
      <circle cx="36" cy="32" r="3" fill="#374151"/>
      <rect x="6" y="35" width="40" height="14" rx="3" fill="#0f172a" opacity="0.95"/>
      <text x="26" y="46" font-family="monospace" font-size="9" font-weight="bold"
            fill="${color}" text-anchor="middle" opacity="${opacity}">${label}</text>
      ${confText}
    </svg>
  `;

  return L.divIcon({
    html: svg,
    iconSize: [52, 64],
    iconAnchor: [26, 58],
    popupAnchor: [0, -58],
    className: '',
  });
}

// ── MITAOE Destination Marker ──
function createMitaoeIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
      <ellipse cx="26" cy="60" rx="14" ry="5" fill="rgba(99,102,241,0.3)"/>
      <path d="M26 0 C12 0 2 10 2 22 C2 38 26 58 26 58 C26 58 50 38 50 22 C50 10 40 0 26 0 Z"
            fill="#6366f1" stroke="#4f46e5" stroke-width="2" opacity="1"/>
      <rect x="12" y="8" width="28" height="20" rx="3" fill="white" opacity="0.95"/>
      <rect x="14" y="10" width="10" height="8" rx="1" fill="#6366f1" opacity="0.3"/>
      <rect x="26" y="10" width="12" height="8" rx="1" fill="#6366f1" opacity="0.3"/>
      <rect x="14" y="20" width="24" height="6" rx="1" fill="#6366f1" opacity="0.15"/>
      <rect x="6" y="32" width="40" height="14" rx="3" fill="#312e81" opacity="0.95"/>
      <text x="26" y="43" font-family="monospace" font-size="7" font-weight="bold"
            fill="#c7d2fe" text-anchor="middle">MITAOE</text>
    </svg>
  `;
  return L.divIcon({
    html: svg, iconSize: [52, 64], iconAnchor: [26, 58], className: '', popupAnchor: [0, -58],
  });
}

const stopIcon = new L.DivIcon({
  className: '', html: '<div class="stop-marker"></div>', iconSize: [10, 10], iconAnchor: [5, 5],
});

function getTrafficColor(level) {
  if (level === 'low' || level === 0) return '#22c55e';
  if (level === 'high' || level === 2) return '#ef4444';
  return '#eab308';
}

// ── Fit Bounds ──
function FitBounds({ routes }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const pts = [];
    for (const rdata of Object.values(routes)) {
      if (rdata?.geometry) rdata.geometry.forEach(([lat, lng]) => pts.push([lat, lng]));
    }
    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
      fitted.current = true;
    }
  }, [routes, map]);
  return null;
}

// ── Segmented Route ──
function SegmentedRoute({ geometry, busGeometryIndex, trafficLevel }) {
  if (!geometry || geometry.length < 2) return null;
  const SEG = 20;
  const tColor = getTrafficColor(trafficLevel);
  const segs = [];
  for (let i = 0; i < geometry.length - 1; i += SEG) {
    const end = Math.min(i + SEG + 1, geometry.length);
    const pts = geometry.slice(i, end);
    const mid = i + SEG / 2;
    const behind = mid < (busGeometryIndex || 0);
    segs.push({ positions: pts, color: behind ? '#4b5563' : tColor, opacity: behind ? 0.35 : 0.7 });
  }
  return <>{segs.map((s, i) => <Polyline key={i} positions={s.positions} pathOptions={{ color: s.color, weight: 3.5, opacity: s.opacity }} />)}</>;
}

// ── Dead Zone Overlay ──
function DeadZoneOverlay({ routes, deadZones }) {
  if (!deadZones || deadZones.length === 0) return null;

  return (
    <>
      {deadZones.map((dz) => {
        const segments = [];
        for (const rid of dz.route_ids) {
          const route = routes[rid];
          if (!route?.geometry || !route?.stops) continue;
          for (const si of dz.affected_stop_indices) {
            if (si < route.stops.length - 1) {
              const fromStop = route.stops[si];
              const toStop = route.stops[si + 1];
              // Find geometry segment between these stops
              const fromPt = [fromStop.lat, fromStop.lng];
              const toPt = [toStop.lat, toStop.lng];
              // Use a simplified approach: draw line between the two stop coords
              segments.push({ from: fromPt, to: toPt });
            }
          }
        }

        const isBlackout = dz.severity === 'blackout';
        const color = isBlackout ? '#7c3aed' : '#f59e0b';
        const dashArray = isBlackout ? '8 6' : '3 4';

        return segments.map((seg, i) => (
          <Polyline key={`${dz.zone_id}-${i}`}
            positions={[seg.from, seg.to]}
            pathOptions={{ color, weight: 7, opacity: 0.55, dashArray }}
            eventHandlers={{
              mouseover: (e) => {
                const popup = L.popup({ className: 'dead-zone-popup', maxWidth: 320 })
                  .setLatLng(e.latlng)
                  .setContent(`
                    <div style="font-family:system-ui; font-size:11px; line-height:1.6;">
                      <div style="font-weight:800; color:${color}; margin-bottom:4px;">
                        DEAD ZONE — ${dz.name}
                      </div>
                      <div style="border-top:1px solid #e2e8f0; padding-top:4px;">
                        <b>Severity:</b> Signal ${dz.severity === 'blackout' ? 'Blackout' : 'Weak'}<br/>
                        <b>Signal Range:</b> ${dz.signal_range[0]} – ${dz.signal_range[1]}%<br/>
                        <b>Historical Rate:</b> ${(dz.historical_blackout_rate * 100).toFixed(0)}% packet loss<br/>
                        <b>Avg Duration:</b> ${dz.avg_duration_minutes} min<br/>
                        <b>Confidence:</b> ${(dz.confidence_score * 100).toFixed(0)}%
                      </div>
                      <div style="border-top:1px solid #e2e8f0; padding-top:4px; margin-top:4px; font-size:10px; color:#64748b;">
                        ${dz.reason}
                      </div>
                      <div style="border-top:1px solid #e2e8f0; padding-top:4px; margin-top:4px; font-size:10px; color:#6366f1;">
                        → Ghost bus activated automatically<br/>
                        → Store-and-forward buffer engaged<br/>
                        → ETA confidence cone widened to ±40%
                      </div>
                    </div>
                  `)
                  .openOn(e.target._map);
              },
            }}
          />
        ));
      })}
    </>
  );
}

// ── Bus Trail ──
function BusTrail({ trail }) {
  if (!trail || trail.length < 2) return null;
  return <Polyline positions={trail.map(p => [p.lat, p.lng])} pathOptions={{ color: '#0d9488', weight: 2, opacity: 0.3, dashArray: '4 4' }} />;
}

// ══════════════════════════════════════════════════════════════
// Main MapView
// ══════════════════════════════════════════════════════════════

export default function MapView({ routes, buses, bufferedPings, deadZones, mitaoe, onBusSelect, compact = false }) {
  const center = [18.54, 73.85];
  const mitaoeIcon = useMemo(() => createMitaoeIcon(), []);

  const allStops = useMemo(() => {
    const stops = [];
    for (const [routeId, rdata] of Object.entries(routes || {})) {
      if (rdata?.stops) rdata.stops.forEach(s => stops.push({ ...s, routeId }));
    }
    return stops;
  }, [routes]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <MapContainer center={center} zoom={12} className="w-full h-full" zoomControl={!compact} attributionControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="&copy; CARTO" />
        <FitBounds routes={routes} />

        {/* Route polylines */}
        {Object.entries(routes || {}).map(([routeId, rdata]) => {
          const bus = Object.values(buses || {}).find(b => b.route_id === routeId);
          return <SegmentedRoute key={routeId} geometry={rdata.geometry} busGeometryIndex={bus?.geometry_index ?? 0} trafficLevel={bus?.traffic_level ?? 'medium'} />;
        })}

        {/* Dead zone overlays */}
        <DeadZoneOverlay routes={routes} deadZones={deadZones} />

        {/* Stop markers */}
        {!compact && allStops.map((stop, i) => (
          <Marker key={`stop-${i}`} position={[stop.lat, stop.lng]} icon={stopIcon}>
            <Tooltip direction="right" offset={[8, 0]} className="!bg-white !text-gray-700 !border-gray-200 !rounded-lg !text-xs !px-2 !py-1 !shadow-md">
              {stop.name}
            </Tooltip>
          </Marker>
        ))}

        {/* MITAOE destination marker */}
        {mitaoe && (
          <Marker position={[mitaoe.lat, mitaoe.lng]} icon={mitaoeIcon} zIndexOffset={200}>
            <Tooltip direction="top" offset={[0, -60]} permanent className="!bg-indigo-600 !text-white !border-indigo-700 !rounded-lg !text-[10px] !font-bold !px-2.5 !py-1 !shadow-lg">
              MIT Academy of Engineering
            </Tooltip>
          </Marker>
        )}

        {/* Bus markers */}
        {Object.entries(buses || {}).map(([busId, bdata]) => {
          if (!bdata.lat || !bdata.lng) return null;
          const icon = createBusIcon(bdata);
          return (
            <React.Fragment key={busId}>
              <BusTrail trail={bdata.trail} />
              <Marker position={[bdata.lat, bdata.lng]} icon={icon} zIndexOffset={bdata.is_ghost ? -100 : 100}
                eventHandlers={{ click: () => onBusSelect?.(busId) }}>
                <Tooltip direction="top" offset={[0, -60]} className="!bg-white !text-gray-800 !border-gray-200 !rounded-lg !text-xs !px-2.5 !py-1 !shadow-md !font-medium">
                  <span>{bdata.label} — {bdata.speed_kmh?.toFixed(1) ?? '—'} km/h</span>
                  {bdata.is_ghost && <span className="block text-orange-500 text-[9px]">Ghost (EST {Math.round((bdata.ghost_confidence || 0.5) * 100)}%)</span>}
                  {bdata.dead_zone?.active && <span className="block text-purple-500 text-[9px]">Dead Zone: {bdata.dead_zone.name}</span>}
                  {onBusSelect && <span className="block text-[8px] text-indigo-500 font-semibold mt-0.5">Click to track in 3D</span>}
                </Tooltip>
              </Marker>
            </React.Fragment>
          );
        })}

        {!compact && <MapLegend />}
      </MapContainer>

      {/* Offline overlays */}
      {Object.entries(buses || {}).map(([busId, bdata], idx) => {
        if (!bdata.is_ghost) return null;
        return (
          <div key={busId} className="absolute left-3 z-[1000] bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-md"
            style={{ top: `${12 + idx * 36}px` }}>
            <div className="signal-dot offline" />
            <span className="text-red-600 font-semibold text-[10px]">{bdata.label} — Signal Lost</span>
          </div>
        );
      })}
    </div>
  );
}
