/**
 * MapView.jsx — Phase 6: Fully prop-driven, theme-aware, mapId support for multiple instances.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import MapLegend from './MapLegend';
import { useTheme } from '../context/ThemeContext';

// ── Custom SVG bus icon ──
function createBusIcon(bus) {
  const signal = bus.signal_strength ?? 85;
  const color = signal > 70 ? '#22c55e' : signal > 40 ? '#eab308' : bus.is_ghost ? '#ffffff' : '#ef4444';
  const opacity = bus.is_ghost ? 0.5 : 1.0;
  const dashArray = bus.is_ghost ? '6,3' : 'none';
  const label = bus.label || bus.bus_id || '?';
  const confText = bus.is_ghost && bus.ghost_confidence
    ? `<text x="26" y="20" font-size="8" fill="white" text-anchor="middle" opacity="0.8">EST ${Math.round(bus.ghost_confidence * 100)}%</text>` : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
      <ellipse cx="26" cy="60" rx="12" ry="4" fill="rgba(0,0,0,0.3)"/>
      <path d="M26 0 C12 0 2 10 2 22 C2 38 26 58 26 58 C26 58 50 38 50 22 C50 10 40 0 26 0 Z"
            fill="#1e293b" stroke="${color}" stroke-width="3" stroke-dasharray="${dashArray}" opacity="${opacity}"/>
      <rect x="10" y="8" width="32" height="22" rx="4" fill="${color}" opacity="${opacity}"/>
      <rect x="13" y="11" width="8" height="6" rx="1" fill="#1e293b" opacity="0.8"/>
      <rect x="24" y="11" width="8" height="6" rx="1" fill="#1e293b" opacity="0.8"/>
      <rect x="35" y="11" width="5" height="6" rx="1" fill="#1e293b" opacity="0.8"/>
      <circle cx="16" cy="32" r="3" fill="#374151"/><circle cx="36" cy="32" r="3" fill="#374151"/>
      <rect x="6" y="35" width="40" height="14" rx="3" fill="#0f172a" opacity="0.95"/>
      <text x="26" y="46" font-family="monospace" font-size="9" font-weight="bold"
            fill="${color}" text-anchor="middle" opacity="${opacity}">${label}</text>
      ${confText}
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [52, 64], iconAnchor: [26, 58], popupAnchor: [0, -58], className: '' });
}

function createMitaoeIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
      <ellipse cx="26" cy="60" rx="14" ry="5" fill="rgba(99,102,241,0.3)"/>
      <path d="M26 0 C12 0 2 10 2 22 C2 38 26 58 26 58 C26 58 50 38 50 22 C50 10 40 0 26 0 Z"
            fill="#6366f1" stroke="#4f46e5" stroke-width="2"/>
      <rect x="12" y="8" width="28" height="20" rx="3" fill="white" opacity="0.95"/>
      <rect x="14" y="10" width="10" height="8" rx="1" fill="#6366f1" opacity="0.3"/>
      <rect x="26" y="10" width="12" height="8" rx="1" fill="#6366f1" opacity="0.3"/>
      <rect x="6" y="32" width="40" height="14" rx="3" fill="#312e81" opacity="0.95"/>
      <text x="26" y="43" font-family="monospace" font-size="7" font-weight="bold" fill="#c7d2fe" text-anchor="middle">MITAOE</text>
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [52, 64], iconAnchor: [26, 58], className: '', popupAnchor: [0, -58] });
}

const stopIcon = new L.DivIcon({ className: '', html: '<div class="stop-marker"></div>', iconSize: [10, 10], iconAnchor: [5, 5] });

function getTrafficColor(level) {
  if (level === 'low' || level === 0) return '#22c55e';
  if (level === 'high' || level === 2) return '#ef4444';
  return '#eab308';
}

function FitBounds({ routes }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const pts = [];
    for (const rdata of Object.values(routes)) {
      if (rdata?.geometry) rdata.geometry.forEach(([lat, lng]) => pts.push([lat, lng]));
    }
    if (pts.length > 0) { map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] }); fitted.current = true; }
  }, [routes, map]);
  return null;
}

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

function DeadZoneOverlay({ routes, deadZones }) {
  if (!deadZones || deadZones.length === 0) return null;
  return (
    <>
      {deadZones.map((dz) => {
        const segments = [];
        for (const rid of dz.route_ids) {
          const route = routes[rid];
          if (!route?.stops) continue;
          for (const si of dz.affected_stop_indices) {
            if (si < route.stops.length - 1) {
              segments.push({ from: [route.stops[si].lat, route.stops[si].lng], to: [route.stops[si + 1].lat, route.stops[si + 1].lng] });
            }
          }
        }
        const isBlackout = dz.severity === 'blackout';
        const color = isBlackout ? '#7c3aed' : '#f59e0b';
        const dashArray = isBlackout ? '8 6' : '3 4';
        return segments.map((seg, i) => (
          <Polyline key={`${dz.zone_id}-${i}`} positions={[seg.from, seg.to]}
            pathOptions={{ color, weight: 7, opacity: 0.55, dashArray }}
            eventHandlers={{
              mouseover: (e) => {
                const reason = dz.reason?.length > 120 ? dz.reason.slice(0, 120) + '...' : dz.reason;
                L.popup({ className: 'zekrom-popup', maxWidth: 280 })
                  .setLatLng(e.latlng)
                  .setContent(`<div style="font-size:13px;line-height:1.5"><div style="font-weight:800;color:${color};margin-bottom:4px">DEAD ZONE — ${dz.name}</div><div style="border-top:1px solid #e2e8f0;padding-top:4px"><b>Severity:</b> ${dz.severity}<br/><b>Signal:</b> ${dz.signal_range[0]}–${dz.signal_range[1]}%<br/><b>Blackout Rate:</b> ${(dz.historical_blackout_rate * 100).toFixed(0)}%<br/><b>Avg Duration:</b> ${dz.avg_duration_minutes} min<br/><b>Confidence:</b> ${(dz.confidence_score * 100).toFixed(0)}%</div><div style="margin-top:4px;font-size:12px;color:#64748b">${reason}</div></div>`)
                  .openOn(e.target._map);
              },
            }} />
        ));
      })}
    </>
  );
}

function BusTrail({ trail }) {
  if (!trail || trail.length < 2) return null;
  return <Polyline positions={trail.map(p => [p.lat, p.lng])} pathOptions={{ color: '#0d9488', weight: 2, opacity: 0.3, dashArray: '4 4' }} />;
}

function BusPopup({ bus }) {
  const sig = bus.signal_strength ?? 85;
  const sigColor = sig >= 70 ? '#22c55e' : sig >= 40 ? '#eab308' : '#ef4444';
  const trafColor = bus.traffic_level === 'high' ? '#ef4444' : bus.traffic_level === 'low' ? '#22c55e' : '#eab308';
  const conf = bus.confidence_score ?? 0.8;
  return (
    <div style={{ width: '240px', fontSize: '13px', lineHeight: 1.5, fontFamily: 'system-ui' }}>
      <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px' }}>
        {bus.label} <span style={{ fontWeight: 500, color: '#64748b' }}>{bus.route_name || bus.route_id}</span>
      </div>
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px' }}>
        <span style={{ color: '#64748b' }}>Signal</span>
        <span style={{ fontWeight: 700, color: sigColor }}>{sig}%</span>
        <span style={{ color: '#64748b' }}>Speed</span>
        <span style={{ fontWeight: 600 }}>{bus.speed_kmh?.toFixed(1) ?? '—'} km/h</span>
        <span style={{ color: '#64748b' }}>Traffic</span>
        <span style={{ fontWeight: 600, color: trafColor, textTransform: 'capitalize' }}>{bus.traffic_level ?? 'medium'}</span>
        <span style={{ color: '#64748b' }}>Next Stop</span>
        <span style={{ fontWeight: 600 }}>{bus.next_stop || '—'}</span>
        <span style={{ color: '#64748b' }}>Status</span>
        <span style={{ fontWeight: 700, color: bus.is_ghost ? '#f97316' : '#22c55e' }}>{bus.is_ghost ? 'GHOST' : 'LIVE'}</span>
      </div>
      <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '6px', paddingTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#64748b', fontSize: '12px' }}>Confidence</span>
        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '3px', width: `${Math.round(conf * 100)}%`, background: conf >= 0.75 ? '#22c55e' : conf >= 0.5 ? '#eab308' : '#ef4444' }} />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: conf >= 0.75 ? '#22c55e' : conf >= 0.5 ? '#eab308' : '#ef4444' }}>{Math.round(conf * 100)}%</span>
      </div>
    </div>
  );
}

// ══ Main MapView ══
export default function MapView({ routes, buses, deadZones, mitaoe, onBusSelect, compact = false, mapId = 'live-map', showLegend = true }) {
  const { theme } = useTheme();
  const center = [18.54, 73.85];
  const mitaoeIcon = useMemo(() => createMitaoeIcon(), []);

  const tileUrl = theme === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  const allStops = useMemo(() => {
    const stops = [];
    for (const [routeId, rdata] of Object.entries(routes || {})) {
      if (rdata?.stops) rdata.stops.forEach(s => stops.push({ ...s, routeId }));
    }
    return stops;
  }, [routes]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
      <MapContainer key={mapId} center={center} zoom={12} style={{ width: '100%', height: '100%' }} zoomControl={!compact} attributionControl={false} id={mapId}>
        <TileLayer url={tileUrl} attribution="&copy; CARTO" />
        <FitBounds routes={routes} />

        {Object.entries(routes || {}).map(([routeId, rdata]) => {
          const bus = Object.values(buses || {}).find(b => b.route_id === routeId);
          return <SegmentedRoute key={routeId} geometry={rdata.geometry} busGeometryIndex={bus?.geometry_index ?? 0} trafficLevel={bus?.traffic_level ?? 'medium'} />;
        })}

        <DeadZoneOverlay routes={routes} deadZones={deadZones} />

        {!compact && allStops.map((stop, i) => (
          <Marker key={`stop-${i}`} position={[stop.lat, stop.lng]} icon={stopIcon}>
            <Tooltip direction="right" offset={[8, 0]} className="zekrom-tooltip">{stop.name}</Tooltip>
          </Marker>
        ))}

        {mitaoe && (
          <Marker position={[mitaoe.lat, mitaoe.lng]} icon={mitaoeIcon} zIndexOffset={200}>
            <Tooltip direction="top" offset={[0, -60]} permanent className="zekrom-tooltip-mitaoe">MIT Academy of Engineering</Tooltip>
          </Marker>
        )}

        {Object.entries(buses || {}).map(([busId, bdata]) => {
          if (!bdata.lat || !bdata.lng) return null;
          const icon = createBusIcon(bdata);
          return (
            <React.Fragment key={busId}>
              <BusTrail trail={bdata.trail} />
              <Marker position={[bdata.lat, bdata.lng]} icon={icon} zIndexOffset={bdata.is_ghost ? -100 : 100}
                eventHandlers={{ click: () => onBusSelect?.(busId) }}>
                <Popup className="zekrom-popup" maxWidth={280}><BusPopup bus={bdata} /></Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {showLegend && !compact && <MapLegend />}
      </MapContainer>

      {/* Ghost overlays */}
      {Object.entries(buses || {}).map(([busId, bdata], idx) => {
        if (!bdata.is_ghost) return null;
        return (
          <div key={busId} style={{
            position: 'absolute', left: '12px', top: `${12 + idx * 36}px`, zIndex: 1000,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            padding: '4px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
            backdropFilter: 'blur(4px)',
          }}>
            <div className="signal-dot offline" />
            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '12px' }}>{bdata.label} — Signal Lost</span>
          </div>
        );
      })}
    </div>
  );
}
