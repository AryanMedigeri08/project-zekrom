/**
 * MapView — Multi-bus Leaflet map with color-coded markers and routes.
 *
 * Route lines: segmented by traffic level (green/yellow/red ahead, gray behind bus).
 * Bus markers: colored by signal strength with CSS pulse animation.
 * Ghost markers: translucent, dashed, labeled "EST."
 * Trails: fading polyline of last 30 positions per bus.
 */

import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import MapLegend from './MapLegend';

// ── Marker factory ──
function createBusIcon(label, signalStrength) {
  const color = signalStrength > 70 ? '#22c55e'
    : signalStrength > 40 ? '#eab308'
    : '#ef4444';

  return L.divIcon({
    className: '',
    html: `
      <div class="bus-marker-dot" style="--marker-color: ${color}">
        <span class="bus-label">${label}</span>
        <div class="pulse-ring"></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function createGhostIcon(label) {
  return L.divIcon({
    className: '',
    html: `
      <div class="bus-marker-ghost">
        <span class="bus-label">${label}</span>
        <span class="est-label">EST.</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

const stopIcon = new L.DivIcon({
  className: '',
  html: '<div class="stop-marker"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// ── Traffic color helper ──
function getTrafficColor(level) {
  if (level === 'low' || level === 0) return '#22c55e';
  if (level === 'high' || level === 2) return '#ef4444';
  return '#eab308';
}

// ── Fit bounds ──
function FitBounds({ routes }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    const allPoints = [];
    for (const rdata of Object.values(routes)) {
      if (rdata?.geometry) {
        for (const [lat, lng] of rdata.geometry) {
          allPoints.push([lat, lng]);
        }
      }
    }
    if (allPoints.length > 0) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] });
      fitted.current = true;
    }
  }, [routes, map]);

  return null;
}

// ── Segmented route polyline ──
function SegmentedRoute({ geometry, busGeometryIndex, trafficLevel, routeColorId }) {
  if (!geometry || geometry.length < 2) return null;

  const SEGMENT_SIZE = 20;
  const trafficColor = getTrafficColor(trafficLevel);
  const segments = [];

  // Split geometry into chunks of SEGMENT_SIZE points
  for (let i = 0; i < geometry.length - 1; i += SEGMENT_SIZE) {
    const end = Math.min(i + SEGMENT_SIZE + 1, geometry.length);
    const points = geometry.slice(i, end).map(([lat, lng]) => [lat, lng]);

    // Behind bus = gray, ahead = traffic color
    const segmentMidIndex = i + SEGMENT_SIZE / 2;
    const isBehind = segmentMidIndex < (busGeometryIndex || 0);

    segments.push({
      positions: points,
      color: isBehind ? '#d1d5db' : trafficColor,
      opacity: isBehind ? 0.4 : 0.7,
    });
  }

  return (
    <>
      {segments.map((seg, i) => (
        <Polyline
          key={i}
          positions={seg.positions}
          pathOptions={{
            color: seg.color,
            weight: 3.5,
            opacity: seg.opacity,
          }}
        />
      ))}
    </>
  );
}

// ── Bus trail ──
function BusTrail({ trail }) {
  if (!trail || trail.length < 2) return null;
  const positions = trail.map((p) => [p.lat, p.lng]);
  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#0d9488',
        weight: 2,
        opacity: 0.3,
        dashArray: '4 4',
      }}
    />
  );
}

// ── Buffer flush replay path ──
function BufferFlushPath({ pings }) {
  if (!pings || pings.length < 2) return null;
  const positions = pings.map((p) => [p.lat, p.lng]);
  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: '#ea580c',
        weight: 3,
        opacity: 0.7,
        dashArray: '6 5',
      }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════
// Main MapView
// ══════════════════════════════════════════════════════════════════

export default function MapView({ routes, buses, bufferedPings, clearBufferedPings, compact = false }) {
  const center = [18.54, 73.85]; // Pune center

  // Collect all stops from all routes
  const allStops = useMemo(() => {
    const stops = [];
    for (const [routeId, rdata] of Object.entries(routes || {})) {
      if (rdata?.stops) {
        rdata.stops.forEach((s) => stops.push({ ...s, routeId }));
      }
    }
    return stops;
  }, [routes]);

  // Map bus to its route data
  const busRouteMap = useMemo(() => {
    const m = {};
    for (const [busId, bdata] of Object.entries(buses || {})) {
      m[busId] = routes?.[bdata.route_id] || null;
    }
    return m;
  }, [buses, routes]);

  return (
    <div className={`relative w-full h-full rounded-xl overflow-hidden border border-gray-200 shadow-sm`}>
      <MapContainer
        center={center}
        zoom={12}
        className="w-full h-full"
        zoomControl={!compact}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; CARTO'
        />

        <FitBounds routes={routes} />

        {/* Route polylines (segmented coloring) */}
        {Object.entries(routes || {}).map(([routeId, rdata]) => {
          // Find the bus on this route
          const bus = Object.values(buses || {}).find((b) => b.route_id === routeId);
          return (
            <SegmentedRoute
              key={routeId}
              geometry={rdata.geometry}
              busGeometryIndex={bus?.geometry_index ?? 0}
              trafficLevel={bus?.traffic_level ?? 'medium'}
              routeColorId={rdata.color_id}
            />
          );
        })}

        {/* Stop markers (only show if not compact) */}
        {!compact && allStops.map((stop, i) => (
          <Marker key={i} position={[stop.lat, stop.lng]} icon={stopIcon}>
            <Tooltip
              direction="right" offset={[8, 0]} permanent={false}
              className="!bg-white !text-gray-700 !border-gray-200 !rounded-lg !text-xs !px-2 !py-1 !shadow-md"
            >
              {stop.name}
            </Tooltip>
          </Marker>
        ))}

        {/* Bus markers + trails + buffer paths */}
        {Object.entries(buses || {}).map(([busId, bdata]) => {
          if (!bdata.lat || !bdata.lng) return null;

          const isGhost = bdata.is_ghost || bdata.ping_type === 'ghost';
          const icon = isGhost
            ? createGhostIcon(bdata.label || busId)
            : createBusIcon(bdata.label || busId, bdata.signal_strength ?? 85);

          const busPings = bufferedPings?.[busId];

          return (
            <React.Fragment key={busId}>
              {/* Trail */}
              <BusTrail trail={bdata.trail} />

              {/* Buffer flush path */}
              {busPings && busPings.length > 1 && (
                <BufferFlushPath pings={busPings} />
              )}

              {/* Bus marker */}
              <Marker
                position={[bdata.lat, bdata.lng]}
                icon={icon}
                zIndexOffset={isGhost ? -100 : 100}
              >
                <Tooltip
                  direction="top" offset={[0, -18]} permanent={false}
                  className="!bg-white !text-gray-800 !border-gray-200 !rounded-lg !text-xs !px-2.5 !py-1 !shadow-md !font-medium"
                >
                  {bdata.label || busId} &middot; {bdata.speed_kmh?.toFixed(1) ?? '—'} km/h
                  {isGhost && ' (Estimated)'}
                </Tooltip>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Legend */}
        {!compact && <MapLegend />}
      </MapContainer>

      {/* Offline overlays per bus */}
      {Object.entries(buses || {}).map(([busId, bdata]) => {
        if (!bdata.is_ghost) return null;
        return (
          <div key={busId} className="absolute top-3 left-3 z-[1000] bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-md" style={{ top: `${12 + Object.keys(buses).indexOf(busId) * 36}px` }}>
            <div className="signal-dot offline" />
            <span className="text-red-600 font-semibold text-[10px]">
              {bdata.label} — Signal Lost
            </span>
          </div>
        );
      })}
    </div>
  );
}
