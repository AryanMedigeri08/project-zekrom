/**
 * MapboxView.jsx — Mission Control 3D View
 */

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import AIDecisionLog from './AIDecisionLog';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const BUS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#fff;width:20px;height:20px"><path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-9.75a3.375 3.375 0 00-3.375-3.375h-9A3.375 3.375 0 005.25 7.875v6.375m13.5 4.5V7.875"/></svg>`;

function getSignalColor(sig) {
  if (sig > 70) return '#39ff14';
  if (sig > 40) return '#f97316';
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
    <div class="marker-body-3d" style="border-color: ${sigColor}; box-shadow: 0 0 15px ${sigColor}80">
      <div class="marker-icon">${BUS_SVG}</div>
      <div class="marker-label font-label-caps" style="color:${sigColor}">${bus.label || ''}</div>
    </div>
    <div class="pulse-3d" style="background: ${sigColor}20; border: 2px solid ${sigColor}"></div>
  `;
  if (bus.is_ghost) el.classList.add('ghost-mode-3d');
  return el;
}

export default function MapboxView({ bus, routeGeometry, routeColor, onBack }) {
  if (!bus) return null;

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const userInteracting = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  const mapStyle = 'mapbox://styles/mapbox/dark-v11';

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
          'fill-extrusion-color': '#0a0a0a',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, ['get', 'height']],
          'fill-extrusion-base': ['get', 'min_height'],
          'fill-extrusion-opacity': 0.8,
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
          paint: { 'line-color': routeColor || '#00f2ff', 'line-width': 5, 'line-opacity': 0.7 },
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
    try { if (map.getLayer('route-line-3d')) map.setPaintProperty('route-line-3d', 'line-color', routeColor || '#00f2ff'); } catch {}
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
      if (body) { body.style.borderColor = sigColor; body.style.boxShadow = `0 0 15px ${sigColor}80`; }
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
      <div className="glass-card" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p className="font-label-caps" style={{ color: 'var(--signal-amber)', fontSize: '14px', marginBottom: '8px' }}>3D VIEW UNAVAILABLE</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', fontFamily: 'Inter' }}>
            Add VITE_MAPBOX_TOKEN to <code>frontend/.env</code>
          </p>
          <button onClick={onBack} className="font-label-caps glow-cyan" style={{
            marginTop: '16px', padding: '8px 16px', borderRadius: '4px', border: '1px solid var(--signal-cyan)', cursor: 'pointer',
            background: 'rgba(0,242,255,0.1)', color: 'var(--signal-cyan)', fontSize: '11px',
          }}>RETURN TO FLEET OVERVIEW</button>
        </div>
      </div>
    );
  }

  const sigColor = getSignalColor(bus.signal_strength ?? 85);
  const sigPct = bus.signal_strength ?? 0;
  const trafficLabel = typeof bus.traffic_level === 'string' ? bus.traffic_level : 'medium';
  const trafficColor = trafficLabel === 'low' ? 'var(--signal-green)' : trafficLabel === 'high' ? 'var(--signal-red)' : 'var(--signal-amber)';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }} />

      {/* Back button */}
      <button onClick={onBack} className="font-label-caps" style={{
        position: 'absolute', top: '16px', left: '16px', zIndex: 50,
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', border: `1px solid var(--color-border)`,
        color: 'var(--color-text)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
        fontSize: '11px', transition: 'all 0.2s', boxShadow: '0 0 10px rgba(0,0,0,0.5)',
      }}>
        ← FLEET OVERVIEW
      </button>

      {/* Bus Info HUD */}
      <div className="glass-card" style={{
        position: 'absolute', top: '16px', right: '16px', zIndex: 50, width: '280px',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: 'rgba(0,242,255,0.1)', border: '1px solid var(--signal-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(0,242,255,0.3)' }}>
              <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--signal-cyan)' }}>BUS</span>
            </div>
            <div>
              <div className="font-data-display" style={{ fontSize: '18px', color: 'var(--color-text)' }}>{bus.label || bus.bus_id}</div>
              <div className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{bus.route_name || bus.route_id}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: bus.is_ghost ? 'var(--signal-amber)' : 'var(--signal-green)', animation: 'signal-blink 1.5s infinite', boxShadow: `0 0 8px ${bus.is_ghost?'var(--signal-amber)':'var(--signal-green)'}` }} />
            <span className="font-label-caps" style={{ fontSize: '10px', color: bus.is_ghost ? 'var(--signal-amber)' : 'var(--signal-green)' }}>{bus.is_ghost ? 'EST' : 'LIVE'}</span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <HudRow label="SPEED" value={`${bus.speed_kmh?.toFixed(1) ?? '—'} km/h`} />
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>SIGNAL</span>
              <span className="font-data-display" style={{ fontSize: '14px', color: sigColor, textShadow: `0 0 8px ${sigColor}80` }}>{sigPct}%</span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '2px', width: `${sigPct}%`, background: sigColor, transition: 'width 0.5s', boxShadow: `0 0 8px ${sigColor}` }} />
            </div>
          </div>
          <HudRow label="TRAFFIC" value={trafficLabel.toUpperCase()} valueColor={trafficColor} />
          <HudRow label="NEXT STOP" value={bus.next_stop || '—'} />
          <HudRow label="BUFFER" value={`${bus.buffer_size ?? 0} pings`} />
        </div>

        {bus.is_ghost && (
          <div className="font-label-caps" style={{
            marginTop: '12px', padding: '8px', borderRadius: '4px', textAlign: 'center',
            background: 'rgba(249,115,22,0.1)', border: '1px solid var(--signal-amber)',
            boxShadow: '0 0 15px rgba(249,115,22,0.3)'
          }}>
            <span style={{ fontSize: '11px', color: 'var(--signal-amber)', letterSpacing: '2px' }}>ESTIMATED POSITION</span>
          </div>
        )}
      </div>

      {/* AI Decisions Panel — below HUD */}
      <div className="glass-card" style={{
        position: 'absolute', top: '380px', right: '16px', zIndex: 50, width: '300px',
        maxHeight: '40vh', overflowY: 'auto', padding: 0
      }}>
        <AIDecisionLog busFilter={bus.bus_id || bus.id} />
      </div>
    </div>
  );
}

function HudRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="font-data-display" style={{ fontSize: '14px', color: valueColor || 'var(--color-text)' }}>{value}</span>
    </div>
  );
}
