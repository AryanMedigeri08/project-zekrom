/**
 * MapView — Leaflet map showing the bus route, stops, live bus marker,
 *           and ghost bus (estimated position) during signal loss.
 *
 * Features:
 *   • Route polyline drawn from all waypoints
 *   • Named stop markers with tooltips
 *   • Animated bus marker that glides between pings (useInterpolation)
 *   • Ghost bus marker during dead-zone with "Estimated Position" label
 *   • Auto-fits map to route bounds on load
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import useInterpolation, { useGhostPosition } from '../hooks/useInterpolation';

// -----------------------------------------------------------------
// Custom Leaflet Icons (DivIcon)
// -----------------------------------------------------------------

const busIcon = new L.DivIcon({
  className: '',
  html: '<div class="bus-marker"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const ghostIcon = new L.DivIcon({
  className: '',
  html: '<div class="ghost-marker"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const stopIcon = new L.DivIcon({
  className: '',
  html: '<div class="stop-marker"></div>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// -----------------------------------------------------------------
// Helper: Auto-fit map to route bounds
// -----------------------------------------------------------------
function FitBounds({ route }) {
  const map = useMap();
  useEffect(() => {
    if (!route || route.length === 0) return;
    const bounds = L.latLngBounds(route.map((wp) => [wp.lat, wp.lng]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [route, map]);
  return null;
}

// -----------------------------------------------------------------
// Animated Bus Marker (separate component so it can use hooks)
// -----------------------------------------------------------------
function AnimatedBusMarker({ busPosition, pingInterval }) {
  // Duration matches the expected time between pings for smooth movement
  const duration = (pingInterval || 2) * 1000;
  const target = busPosition ? { lat: busPosition.lat, lng: busPosition.lng } : null;
  const pos = useInterpolation(target, duration);

  if (!pos) return null;
  return (
    <Marker position={[pos.lat, pos.lng]} icon={busIcon}>
      <Tooltip
        direction="top"
        offset={[0, -16]}
        permanent={false}
        className="!bg-surface-800 !text-gray-100 !border-surface-600 !rounded-lg !text-xs !px-3 !py-1.5 !shadow-lg"
      >
        <span className="font-semibold">
          🚌 Bus · {busPosition?.speed_kmh?.toFixed(1) ?? '—'} km/h
        </span>
      </Tooltip>
    </Marker>
  );
}

// -----------------------------------------------------------------
// Ghost Bus Marker
// -----------------------------------------------------------------
function GhostBusMarker({ lastKnownPosition, isOffline }) {
  const ghostPos = useGhostPosition(lastKnownPosition, isOffline);
  if (!ghostPos) return null;
  return (
    <Marker position={[ghostPos.lat, ghostPos.lng]} icon={ghostIcon}>
      <Tooltip
        direction="top"
        offset={[0, -16]}
        permanent
        className="!bg-surface-800/90 !text-orange-300 !border-accent-orange/30 !rounded-lg !text-xs !px-3 !py-1.5 !shadow-lg"
      >
        ⚠ Estimated Position
      </Tooltip>
    </Marker>
  );
}

// -----------------------------------------------------------------
// Main MapView Component
// -----------------------------------------------------------------
export default function MapView({
  route,
  busPosition,
  signalStrength,
  bufferedPings,
  clearBufferedPings,
}) {
  const isOffline = signalStrength < 10;
  const lastKnownRef = useRef(null);
  const [replayPath, setReplayPath] = useState([]);

  // Track last known position for ghost bus
  useEffect(() => {
    if (busPosition && !isOffline) {
      lastKnownRef.current = busPosition;
    }
  }, [busPosition, isOffline]);

  // When buffer flushes, draw the reconstructed path briefly
  useEffect(() => {
    if (bufferedPings && bufferedPings.length > 0) {
      const path = bufferedPings.map((p) => [p.lat, p.lng]);
      setReplayPath(path);
      // Clear the replay path after 8 seconds
      const timer = setTimeout(() => {
        setReplayPath([]);
        clearBufferedPings();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [bufferedPings, clearBufferedPings]);

  // Extract stops and route path from waypoint data
  const stops = useMemo(
    () => (route ? route.filter((wp) => wp.is_stop) : []),
    [route]
  );

  const routePath = useMemo(
    () => (route ? route.map((wp) => [wp.lat, wp.lng]) : []),
    [route]
  );

  // Determine ping interval for animation duration
  const pingInterval = useMemo(() => {
    if (signalStrength >= 70) return 2;
    if (signalStrength >= 40) return 6;
    if (signalStrength >= 10) return 12;
    return 2;
  }, [signalStrength]);

  // Default center: Pune / MIT AOE area
  const center = [18.6550, 73.8400];

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-surface-600/50">
      <MapContainer
        center={center}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
      >
        {/* Dark-themed OpenStreetMap tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Auto-fit to route */}
        <FitBounds route={route} />

        {/* Route polyline */}
        {routePath.length > 0 && (
          <Polyline
            positions={routePath}
            pathOptions={{
              color: '#118ab2',
              weight: 4,
              opacity: 0.7,
              dashArray: null,
            }}
          />
        )}

        {/* Reconstructed path from buffer flush (orange dashed) */}
        {replayPath.length > 1 && (
          <Polyline
            positions={replayPath}
            pathOptions={{
              color: '#ff9f1c',
              weight: 3,
              opacity: 0.8,
              dashArray: '8 6',
            }}
          />
        )}

        {/* Stop markers */}
        {stops.map((stop, i) => (
          <Marker key={i} position={[stop.lat, stop.lng]} icon={stopIcon}>
            <Tooltip
              direction="right"
              offset={[10, 0]}
              permanent={false}
              className="!bg-surface-800 !text-gray-200 !border-surface-600 !rounded-lg !text-xs !px-2 !py-1 !shadow-lg"
            >
              <span className="font-medium">{stop.name}</span>
            </Tooltip>
          </Marker>
        ))}

        {/* Animated bus marker */}
        <AnimatedBusMarker
          busPosition={busPosition}
          pingInterval={pingInterval}
        />

        {/* Ghost bus (only when offline) */}
        <GhostBusMarker
          lastKnownPosition={lastKnownRef.current}
          isOffline={isOffline}
        />
      </MapContainer>

      {/* Offline overlay badge */}
      {isOffline && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] glass-panel px-5 py-2.5 flex items-center gap-3 animate-pulse">
          <div className="signal-dot offline" />
          <span className="text-accent-red font-semibold text-sm tracking-wide">
            SIGNAL LOST — Showing Estimated Position
          </span>
        </div>
      )}

      {/* Buffer flush notification */}
      {replayPath.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] glass-panel px-5 py-2.5 flex items-center gap-3">
          <span className="text-accent-orange font-semibold text-sm">
            📦 Buffer Flushed — Reconstructed {replayPath.length} positions
          </span>
        </div>
      )}
    </div>
  );
}
