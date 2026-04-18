/**
 * MapboxView.jsx — Phase 6: 3D view with inline AI Decision panel, theme support.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import AIDecisionLog from './AIDecisionLog';
import { useTheme } from '../context/ThemeContext';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#e2e8f0;width:20px;height:20px"><path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-9.75a3.375 3.375 0 00-3.375-3.375h-9A3.375 3.375 0 005.25 7.875v6.375m13.5 4.5V7.875"/></svg>`;

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
      <div class="marker-label">${bus.label || ''}</div>
    </div>
    <div class="marker-shadow-3d"></div>
    <div class="pulse-3d" style="background: ${sigColor}20; border: 2px solid ${sigColor}"></div>
  `;
  if (bus.is_ghost) el.classList.add('ghost-mode-3d');
  return el;
}

export default function MapboxView({ bus, routeGeometry, routeColor, onBack }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const userInteracting = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  const mapStyle = isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';

  useEffect(() => {
    if (!MAPBOX_TOKEN) { setTokenError(true); return; }
    mapboxgl.accessToken = MAPBOX_TOKEN;

    let map;
    try {
      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: mapStyle,
        center: [bus.lng || 73.85, bus.lat || 18.54],
        zoom: 16, pitch: 0, bearing: 0, antialias: true,
      });
    } catch (err) {
      console.error('[Zekrom] Mapbox init failed:', err);
      setTokenError(true);
      return;
    }

    map.on('error', (e) => {
      if (e.error?.status === 401 || e.error?.status === 403) setTokenError(true);
    });
    map.on('dragstart', () => { userInteracting.current = true; });
    map.on('dragend', () => { setTimeout(() => { userInteracting.current = false; }, 3000); });

    map.on('load', () => {
      const layers = map.getStyle().layers;
      const labelLayerId = layers?.find(l => l.type === 'symbol' && l.layout?.['text-field'])?.id;

      map.addLayer({
        id: '3d-buildings', source: 'composite', 'source-layer': 'building',
        filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 14,
        paint: {
          'fill-extrusion-color': isDark ? '#1e293b' : '#e2e8f0',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, ['get', 'height']],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.85,
        },
      }, labelLayerId);

      if (routeGeometry && routeGeometry.length > 1) {
        map.addSource('route-3d', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: routeGeometry.map(([lat, lng]) => [lng, lat]) } },
        });
        map.addLayer({
          id: 'route-line-3d', type: 'line', source: 'route-3d',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': routeColor || '#22c55e', 'line-width': 5, 'line-opacity': 0.85 },
        });
      }

      const markerEl = create3DMarkerElement(bus);
      const marker = new mapboxgl.Marker({ element: markerEl, rotationAlignment: 'map', pitchAlignment: 'map', rotation: bus.heading || 0 })
        .setLngLat([bus.lng || 73.85, bus.lat || 18.54]).addTo(map);
      markerRef.current = marker;

      setTimeout(() => {
        map.flyTo({ center: [bus.lng || 73.85, bus.lat || 18.54], zoom: 17.5, pitch: 58, bearing: bus.heading || 0, duration: 2000, easing: t => t * (2 - t) });
      }, 800);
      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      map.remove(); mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    try { if (map.getLayer('route-line-3d')) map.setPaintProperty('route-line-3d', 'line-color', routeColor || '#22c55e'); } catch {}
  }, [routeColor, mapReady]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !mapReady) return;
    if (!bus.lat || !bus.lng) return;
    markerRef.current.setLngLat([bus.lng, bus.lat]);
    markerRef.current.setRotation(bus.heading || bus.heading_degrees || 0);

    const el = markerRef.current.getElement();
    if (el) {
      const sigColor = getSignalColor(bus.signal_strength ?? 85);
      const body = el.querySelector('.marker-body-3d');
      const pulse = el.querySelector('.pulse-3d');
      if (body) body.style.borderColor = sigColor;
      if (pulse) { pulse.style.background = `${sigColor}20`; pulse.style.borderColor = sigColor; }
      bus.is_ghost ? el.classList.add('ghost-mode-3d') : el.classList.remove('ghost-mode-3d');
    }

    if (!userInteracting.current) {
      const center = mapRef.current.getCenter();
      if (calculateDistance(center.lat, center.lng, bus.lat, bus.lng) > 0.03) {
        mapRef.current.easeTo({ center: [bus.lng, bus.lat], duration: 800, easing: t => t });
      }
    }
  }, [bus.lat, bus.lng, bus.heading, bus.heading_degrees, bus.signal_strength, bus.is_ghost, mapReady]);

  if (tokenError) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', borderRadius: '12px' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>3D View Unavailable</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Add VITE_MAPBOX_TOKEN to <code>frontend/.env</code>
          </p>
          <button onClick={onBack} style={{
            marginTop: '16px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: isDark ? '#1e293b' : '#e2e8f0', color: 'var(--color-text)', fontSize: '13px', fontWeight: 600,
          }}>Return to Fleet View</button>
        </div>
      </div>
    );
  }

  const sigColor = getSignalColor(bus.signal_strength ?? 85);
  const sigPct = bus.signal_strength ?? 0;
  const trafficLabel = typeof bus.traffic_level === 'string' ? bus.traffic_level : 'medium';
  const trafficColor = trafficLabel === 'low' ? '#22c55e' : trafficLabel === 'high' ? '#ef4444' : '#eab308';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }} />

      {/* Back button */}
      <button onClick={onBack} style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 50,
        display: 'flex', alignItems: 'center', gap: '8px',
        background: isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        color: 'var(--color-text)', padding: '8px 14px', borderRadius: '10px', cursor: 'pointer',
        fontSize: '13px', fontWeight: 600,
      }}>
        ← Fleet Overview
      </button>

      {/* Bus Info HUD */}
      <div style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 50, width: '280px',
        background: isDark ? 'rgba(9,9,9,0.85)' : 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)', border: `1px solid ${isDark ? 'rgba(51,65,85,0.6)' : '#e2e8f0'}`,
        borderRadius: '12px', padding: '14px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: sigColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 800 }}>BUS</span>
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>{bus.label || bus.bus_id}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{bus.route_name || bus.route_id}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: bus.is_ghost ? '#ef4444' : '#22c55e', animation: 'signal-blink 1.5s infinite' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>{bus.is_ghost ? 'GHOST' : 'LIVE'}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <HudRow label="Speed" value={`${bus.speed_kmh?.toFixed(1) ?? '—'} km/h`} />
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Signal</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: sigColor }}>{sigPct}%</span>
            </div>
            <div style={{ width: '100%', height: '5px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '3px', width: `${sigPct}%`, background: sigColor, transition: 'width 0.5s' }} />
            </div>
          </div>
          <HudRow label="Traffic" value={trafficLabel} valueColor={trafficColor} />
          <HudRow label="Next Stop" value={bus.next_stop || '—'} />
          <HudRow label="Buffer" value={`${bus.buffer_size ?? 0} pings`} />
        </div>

        {bus.is_ghost && (
          <div style={{
            marginTop: '10px', padding: '6px', borderRadius: '8px', textAlign: 'center',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', letterSpacing: '2px' }}>ESTIMATED POSITION</span>
          </div>
        )}
      </div>

      {/* AI Decisions Panel — below HUD */}
      <div style={{
        position: 'absolute', top: '320px', right: '16px', zIndex: 50, width: '300px',
        maxHeight: '40vh', overflowY: 'auto',
        background: isDark ? 'rgba(9,9,9,0.85)' : 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)', border: `1px solid ${isDark ? 'rgba(51,65,85,0.6)' : '#e2e8f0'}`,
        borderRadius: '12px', padding: '0',
      }}>
        <AIDecisionLog busFilter={bus.bus_id || bus.id} />
      </div>
    </div>
  );
}

function HudRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: valueColor || 'var(--color-text)', textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}
