/**
 * MapboxView — Immersive 3D tracking view for a single selected bus.
 *
 * Features:
 *   - Mapbox GL JS dark-v11 style with 3D buildings
 *   - Entry camera animation (fly-in with pitch tilt)
 *   - Real-time bus marker with signal-colored pulse
 *   - Route line colored by traffic level
 *   - Ghost mode (translucent marker, dashed border)
 *   - Bus Info HUD overlay
 *   - Soft camera follow with user-drag override
 *   - Graceful fallback if Mapbox token is missing
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

// SVG bus icon for the 3D marker (no emoji)
const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5" style="color:#e2e8f0;width:20px;height:20px"><path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-9.75a3.375 3.375 0 00-3.375-3.375h-9A3.375 3.375 0 005.25 7.875v6.375m13.5 4.5V7.875"/></svg>`;

function getSignalColor(sig) {
  if (sig > 70) return '#22c55e';
  if (sig > 40) return '#eab308';
  return '#ef4444';
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const dlat = lat2 - lat1;
  const dlng = lng2 - lng1;
  return Math.sqrt(dlat * dlat + dlng * dlng) * 111;
}

function create3DMarkerElement(bus) {
  const el = document.createElement('div');
  el.className = 'bus-marker-3d';
  const sigColor = getSignalColor(bus.signal_strength ?? 85);

  el.innerHTML = `
    <div class="marker-body-3d" style="border-color: ${sigColor}">
      <div class="marker-icon">${BUS_SVG}</div>
      <div class="marker-label">${bus.label || bus.bus_id || ''}</div>
    </div>
    <div class="marker-shadow-3d"></div>
    <div class="pulse-3d" style="background: ${sigColor}20; border: 2px solid ${sigColor}"></div>
  `;

  if (bus.is_ghost) {
    el.classList.add('ghost-mode-3d');
  }

  return el;
}

// ── HUD Info Panel Icons ──
const SpeedIcon = () => (
  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);
const PinIcon = () => (
  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);
const BackIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
  </svg>
);

// ══════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════

export default function MapboxView({ bus, routeGeometry, routeColor, onBack }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const userInteracting = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  // ── Initialize map ──
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setTokenError(true);
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;

    let map;
    try {
      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [bus.lng || 73.85, bus.lat || 18.54],
        zoom: 16,
        pitch: 0,
        bearing: 0,
        antialias: true,
      });
    } catch (err) {
      console.error('Mapbox init failed:', err);
      setTokenError(true);
      return;
    }

    map.on('error', (e) => {
      if (e.error?.status === 401 || e.error?.status === 403) {
        setTokenError(true);
      }
    });

    map.on('dragstart', () => { userInteracting.current = true; });
    map.on('dragend', () => {
      setTimeout(() => { userInteracting.current = false; }, 3000);
    });

    map.on('load', () => {
      // 1. 3D Buildings
      const layers = map.getStyle().layers;
      const labelLayerId = layers?.find(
        (l) => l.type === 'symbol' && l.layout?.['text-field']
      )?.id;

      map.addLayer(
        {
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#1e293b',
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'],
              14, 0,
              16, ['get', 'height'],
            ],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.85,
          },
        },
        labelLayerId
      );

      // 2. Route line
      if (routeGeometry && routeGeometry.length > 1) {
        map.addSource('route-3d', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: routeGeometry.map(([lat, lng]) => [lng, lat]),
            },
          },
        });

        map.addLayer({
          id: 'route-line-3d',
          type: 'line',
          source: 'route-3d',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': routeColor || '#22c55e',
            'line-width': 5,
            'line-opacity': 0.85,
          },
        });
      }

      // 3. Bus marker
      const markerEl = create3DMarkerElement(bus);
      const marker = new mapboxgl.Marker({
        element: markerEl,
        rotationAlignment: 'map',
        pitchAlignment: 'map',
        rotation: bus.heading || bus.heading_degrees || 0,
      })
        .setLngLat([bus.lng || 73.85, bus.lat || 18.54])
        .addTo(map);

      markerRef.current = marker;

      // 4. Entry animation
      setTimeout(() => {
        map.flyTo({
          center: [bus.lng || 73.85, bus.lat || 18.54],
          zoom: 17.5,
          pitch: 58,
          bearing: bus.heading || bus.heading_degrees || 0,
          duration: 2000,
          easing: (t) => t * (2 - t),
        });
      }, 800);

      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []); // init once

  // ── Update route color when traffic changes ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try {
      if (map.getLayer('route-line-3d')) {
        map.setPaintProperty('route-line-3d', 'line-color', routeColor || '#22c55e');
      }
    } catch { /* layer not ready */ }
  }, [routeColor, mapReady]);

  // ── Update bus position ──
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !mapReady) return;
    if (!bus.lat || !bus.lng) return;

    // Move marker
    markerRef.current.setLngLat([bus.lng, bus.lat]);
    markerRef.current.setRotation(bus.heading || bus.heading_degrees || 0);

    // Update marker element (signal color, ghost)
    const el = markerRef.current.getElement();
    if (el) {
      const sigColor = getSignalColor(bus.signal_strength ?? 85);
      const body = el.querySelector('.marker-body-3d');
      const pulse = el.querySelector('.pulse-3d');
      if (body) body.style.borderColor = sigColor;
      if (pulse) {
        pulse.style.background = `${sigColor}20`;
        pulse.style.borderColor = sigColor;
      }
      if (bus.is_ghost) {
        el.classList.add('ghost-mode-3d');
      } else {
        el.classList.remove('ghost-mode-3d');
      }
    }

    // Soft camera follow (only if user isn't dragging)
    if (!userInteracting.current) {
      const center = mapRef.current.getCenter();
      const dist = calculateDistance(center.lat, center.lng, bus.lat, bus.lng);
      if (dist > 0.03) {
        mapRef.current.easeTo({
          center: [bus.lng, bus.lat],
          duration: 800,
          easing: (t) => t,
        });
      }
    }
  }, [bus.lat, bus.lng, bus.heading, bus.heading_degrees, bus.signal_strength, bus.is_ghost, mapReady]);

  // ── Token error fallback ──
  if (tokenError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-xl">
        <div className="text-center">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-gray-400 text-sm font-semibold mb-1">3D View Unavailable</p>
          <p className="text-gray-600 text-xs">
            Add your Mapbox token to <code className="text-gray-500">frontend/.env</code>
          </p>
          <p className="text-gray-700 text-[10px] mt-1">
            VITE_MAPBOX_TOKEN=pk.your_token_here
          </p>
          <button onClick={onBack}
            className="mt-4 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-700 transition-colors">
            Return to Fleet View
          </button>
        </div>
      </div>
    );
  }

  // ── Traffic / signal label helpers ──
  const sigColor = getSignalColor(bus.signal_strength ?? 85);
  const sigPct = bus.signal_strength ?? 0;
  const trafficLabel = typeof bus.traffic_level === 'string' ? bus.traffic_level : 'medium';
  const trafficColor = trafficLabel === 'low' ? '#22c55e' : trafficLabel === 'high' ? '#ef4444' : '#eab308';
  const statusLabel = bus.is_ghost ? 'GHOST' : (sigPct >= 70 ? 'LIVE' : sigPct >= 40 ? 'SPARSE' : 'WEAK');
  const statusDot = bus.is_ghost ? 'bg-red-500' : sigPct >= 70 ? 'bg-green-500' : sigPct >= 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="relative w-full h-full">
      {/* Mapbox container */}
      <div ref={mapContainerRef} className="w-full h-full rounded-xl overflow-hidden" />

      {/* Back button */}
      <button onClick={onBack}
        className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-gray-900/90 backdrop-blur-md border border-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-all shadow-lg">
        <BackIcon />
        <span className="text-xs font-semibold">Fleet Overview</span>
      </button>

      {/* Bus Info HUD */}
      <div className="absolute top-4 right-4 z-50 w-64 bg-gray-900/85 backdrop-blur-md border border-gray-700/60 rounded-xl p-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: sigColor }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-9.75a3.375 3.375 0 00-3.375-3.375h-9A3.375 3.375 0 005.25 7.875v6.375m13.5 4.5V7.875" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-bold text-white">{bus.label || bus.bus_id}</span>
              <span className="block text-[9px] text-gray-500 uppercase tracking-wider">
                {bus.route_id?.replace('route_', '') || 'Route'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${statusDot} animate-pulse`} />
            <span className="text-[9px] font-bold text-gray-400 tracking-wider">{statusLabel}</span>
          </div>
        </div>

        <div className="border-t border-gray-700/50 my-2" />

        {/* Metrics */}
        <div className="space-y-2">
          <HudRow label="Speed" value={`${bus.speed_kmh?.toFixed(1) ?? '—'} km/h`} icon={<SpeedIcon />} />
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-gray-500">Signal</span>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: sigColor }}>{sigPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${sigPct}%`, background: sigColor }} />
            </div>
          </div>
          <HudRow label="Traffic" value={<span className="capitalize" style={{ color: trafficColor }}>{trafficLabel}</span>} />
          <HudRow label="Next Stop" value={bus.next_stop || '—'} icon={<PinIcon />} />
          <HudRow label="Buffer" value={`${bus.buffer_size ?? 0} pings`} />
        </div>

        {bus.is_ghost && (
          <div className="mt-3 px-2 py-1.5 bg-red-900/30 border border-red-800/50 rounded-lg text-center">
            <span className="text-[10px] font-bold text-red-400 tracking-widest">ESTIMATED POSITION</span>
          </div>
        )}
      </div>
    </div>
  );
}

function HudRow({ label, value, icon }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] text-gray-500">{label}</span>
      </div>
      <span className="text-[11px] font-semibold text-gray-200 tabular-nums">{value}</span>
    </div>
  );
}
