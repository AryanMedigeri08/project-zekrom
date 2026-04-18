/**
 * MapView — Leaflet map (light mode) showing bus route, stops, live marker,
 *           and ghost bus during signal loss.
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

// Custom Leaflet Icons
const busIcon = new L.DivIcon({
  className: '',
  html: '<div class="bus-marker"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const ghostIcon = new L.DivIcon({
  className: '',
  html: '<div class="ghost-marker"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const stopIcon = new L.DivIcon({
  className: '',
  html: '<div class="stop-marker"></div>',
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

// Auto-fit map to route bounds
function FitBounds({ route }) {
  const map = useMap();
  useEffect(() => {
    if (!route || route.length === 0) return;
    const bounds = L.latLngBounds(route.map((wp) => [wp.lat, wp.lng]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [route, map]);
  return null;
}

// Animated Bus Marker
function AnimatedBusMarker({ busPosition, pingInterval }) {
  const duration = (pingInterval || 2) * 1000;
  const target = busPosition ? { lat: busPosition.lat, lng: busPosition.lng } : null;
  const pos = useInterpolation(target, duration);

  if (!pos) return null;
  return (
    <Marker position={[pos.lat, pos.lng]} icon={busIcon}>
      <Tooltip
        direction="top"
        offset={[0, -14]}
        permanent={false}
        className="!bg-white !text-gray-800 !border-gray-200 !rounded-lg !text-xs !px-2.5 !py-1 !shadow-md !font-medium"
      >
        Bus &middot; {busPosition?.speed_kmh?.toFixed(1) ?? '—'} km/h
      </Tooltip>
    </Marker>
  );
}

// Ghost Bus Marker
function GhostBusMarker({ lastKnownPosition, isOffline }) {
  const ghostPos = useGhostPosition(lastKnownPosition, isOffline);
  if (!ghostPos) return null;
  return (
    <Marker position={[ghostPos.lat, ghostPos.lng]} icon={ghostIcon}>
      <Tooltip
        direction="top"
        offset={[0, -14]}
        permanent
        className="!bg-orange-50 !text-orange-700 !border-orange-200 !rounded-lg !text-xs !px-2.5 !py-1 !shadow-md !font-semibold"
      >
        Estimated Position
      </Tooltip>
    </Marker>
  );
}

// Main MapView Component
export default function MapView({
  route,
  busPosition,
  signalStrength,
  bufferedPings,
  clearBufferedPings,
  compact = false,
}) {
  const isOffline = signalStrength < 10;
  const lastKnownRef = useRef(null);
  const [replayPath, setReplayPath] = useState([]);

  useEffect(() => {
    if (busPosition && !isOffline) {
      lastKnownRef.current = busPosition;
    }
  }, [busPosition, isOffline]);

  useEffect(() => {
    if (bufferedPings && bufferedPings.length > 0) {
      const path = bufferedPings.map((p) => [p.lat, p.lng]);
      setReplayPath(path);
      const timer = setTimeout(() => {
        setReplayPath([]);
        clearBufferedPings();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [bufferedPings, clearBufferedPings]);

  const stops = useMemo(
    () => (route ? route.filter((wp) => wp.is_stop) : []),
    [route]
  );

  const routePath = useMemo(
    () => (route ? route.map((wp) => [wp.lat, wp.lng]) : []),
    [route]
  );

  const pingInterval = useMemo(() => {
    if (signalStrength >= 70) return 2;
    if (signalStrength >= 40) return 6;
    if (signalStrength >= 10) return 12;
    return 2;
  }, [signalStrength]);

  const center = [18.6550, 73.8400];

  return (
    <div className={`relative w-full h-full rounded-xl overflow-hidden border border-gray-200 shadow-sm ${compact ? '' : ''}`}>
      <MapContainer
        center={center}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
      >
        {/* Light-mode OpenStreetMap tiles (CARTO Voyager) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        <FitBounds route={route} />

        {/* Route polyline */}
        {routePath.length > 0 && (
          <Polyline
            positions={routePath}
            pathOptions={{
              color: '#0284c7',
              weight: 3.5,
              opacity: 0.6,
            }}
          />
        )}

        {/* Buffer flush replay path */}
        {replayPath.length > 1 && (
          <Polyline
            positions={replayPath}
            pathOptions={{
              color: '#ea580c',
              weight: 3,
              opacity: 0.7,
              dashArray: '6 5',
            }}
          />
        )}

        {/* Stop markers */}
        {stops.map((stop, i) => (
          <Marker key={i} position={[stop.lat, stop.lng]} icon={stopIcon}>
            <Tooltip
              direction="right"
              offset={[8, 0]}
              permanent={false}
              className="!bg-white !text-gray-700 !border-gray-200 !rounded-lg !text-xs !px-2 !py-1 !shadow-md"
            >
              {stop.name}
            </Tooltip>
          </Marker>
        ))}

        <AnimatedBusMarker busPosition={busPosition} pingInterval={pingInterval} />
        <GhostBusMarker lastKnownPosition={lastKnownRef.current} isOffline={isOffline} />
      </MapContainer>

      {/* Offline overlay */}
      {isOffline && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-red-50 border border-red-200 px-4 py-2 rounded-lg flex items-center gap-2 shadow-md animate-pulse">
          <div className="signal-dot offline" />
          <span className="text-red-600 font-semibold text-xs tracking-wide">
            SIGNAL LOST — Estimated Position Shown
          </span>
        </div>
      )}

      {/* Buffer flush notification */}
      {replayPath.length > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] bg-orange-50 border border-orange-200 px-4 py-2 rounded-lg flex items-center gap-2 shadow-md">
          <span className="text-orange-700 font-semibold text-xs">
            Buffer Flushed — {replayPath.length} positions reconstructed
          </span>
        </div>
      )}
    </div>
  );
}
