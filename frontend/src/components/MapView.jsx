/**
 * MapView.jsx — Phase 9: Professional Clean Signal Map
 *
 * Changes from Phase 8:
 *   - Default zoom level 13 (shows full route, movement visible)
 *   - Uses distance_km for route progress instead of geometry_index
 *   - Focused bus zoom level 15
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import MapLegend from './MapLegend';

// ── Custom SVG bus icon ──
function createBusIcon(bus) {
  const signal = bus.signal_strength ?? 85;
  const color = signal >= 70 ? '#10b981' : signal >= 40 ? '#f59e0b' : bus.is_ghost ? '#6366f1' : '#ef4444';
  const label = bus.label || bus.bus_id || '?';
  const dashArray = bus.is_ghost ? '4,4' : 'none';
  const opacity = bus.is_ghost ? 0.7 : 1.0;
  
  const confText = bus.is_ghost && bus.ghost_confidence
    ? `<text x="26" y="20" font-family="'Inter', sans-serif" font-weight="600" font-size="8" fill="#fff" text-anchor="middle">EST ${Math.round(bus.ghost_confidence * 100)}%</text>` : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
      <ellipse cx="26" cy="62" rx="12" ry="3" fill="rgba(0,0,0,0.1)"/>
      <path d="M26 0 C12 0 2 10 2 22 C2 38 26 60 26 60 C26 60 50 38 50 22 C50 10 40 0 26 0 Z"
            fill="rgba(255,255,255,0.9)" stroke="${color}" stroke-width="2" stroke-dasharray="${dashArray}" style="fill-opacity:${opacity}; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1))"/>
      <rect x="10" y="8" width="32" height="22" rx="4" fill="${color}" opacity="${opacity}"/>
      <rect x="13" y="11" width="8" height="6" rx="2" fill="#fff" opacity="0.9"/>
      <rect x="24" y="11" width="8" height="6" rx="2" fill="#fff" opacity="0.9"/>
      <rect x="35" y="11" width="5" height="6" rx="2" fill="#fff" opacity="0.9"/>
      <circle cx="16" cy="32" r="3" fill="#cbd5e1"/><circle cx="36" cy="32" r="3" fill="#cbd5e1"/>
      <rect x="6" y="36" width="40" height="14" rx="4" fill="#fff" stroke="${color}" stroke-width="1.5"/>
      <text x="26" y="46" font-family="'Inter', sans-serif" font-size="8" font-weight="700"
            fill="${color}" text-anchor="middle" opacity="1">${label}</text>
      ${confText}
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [52, 64], iconAnchor: [26, 60], popupAnchor: [0, -60], className: '' });
}

function createMitaoeIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
      <ellipse cx="26" cy="62" rx="14" ry="4" fill="rgba(0,0,0,0.1)"/>
      <path d="M26 0 C12 0 2 10 2 22 C2 38 26 60 26 60 C26 60 50 38 50 22 C50 10 40 0 26 0 Z"
            fill="rgba(255,255,255,0.9)" stroke="#6366f1" stroke-width="2" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1))"/>
      <rect x="12" y="8" width="28" height="20" rx="4" fill="#6366f1" opacity="0.1"/>
      <rect x="14" y="10" width="10" height="8" rx="2" fill="#6366f1" opacity="0.8"/>
      <rect x="26" y="10" width="12" height="8" rx="2" fill="#6366f1" opacity="0.8"/>
      <rect x="6" y="34" width="40" height="14" rx="4" fill="#fff" stroke="#6366f1" stroke-width="2"/>
      <text x="26" y="44" font-family="'Inter', sans-serif" font-size="7" font-weight="700" fill="#6366f1" letter-spacing="0.5px" text-anchor="middle">MITAOE</text>
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [52, 64], iconAnchor: [26, 60], className: '', popupAnchor: [0, -60] });
}

const stopIcon = new L.DivIcon({ className: '', html: '<div style="width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid #6366f1;box-shadow:0 2px 4px rgba(0,0,0,0.1)"></div>', iconSize: [10, 10], iconAnchor: [5, 5] });

function getTrafficColor(level) {
  if (level === 'low' || level === 0) return '#10b981';
  if (level === 'high' || level === 2) return '#ef4444';
  return '#f59e0b';
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
    if (pts.length > 0) {
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 });
      fitted.current = true;
    }
  }, [routes, map]);
  return null;
}

function SegmentedRoute({ geometry, routeProgress, trafficLevel }) {
  if (!geometry || geometry.length < 2) return null;
  const SEG = 20;
  const tColor = getTrafficColor(trafficLevel);
  const segs = [];
  const totalSegs = geometry.length - 1;

  for (let i = 0; i < geometry.length - 1; i += SEG) {
    const end = Math.min(i + SEG + 1, geometry.length);
    const pts = geometry.slice(i, end);
    const mid = (i + Math.min(i + SEG, totalSegs)) / 2;
    const segProgress = mid / totalSegs;
    const behind = segProgress < (routeProgress || 0);
    segs.push({ positions: pts, color: behind ? 'rgba(99,102,241,0.5)' : tColor, opacity: behind ? 0.5 : 1, behind });
  }
  return <>{segs.map((s, i) => <Polyline key={i} positions={s.positions} pathOptions={{ color: s.color, weight: 5, opacity: s.opacity, lineCap: 'round' }} />)}</>;
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
        const color = isBlackout ? '#ef4444' : '#f59e0b';
        const dashArray = isBlackout ? '8 6' : '3 4';
        return segments.map((seg, i) => (
          <Polyline key={`${dz.zone_id}-${i}`} positions={[seg.from, seg.to]}
            pathOptions={{ color, weight: 6, opacity: 0.7, dashArray }}
            eventHandlers={{
              mouseover: (e) => {
                const reason = dz.reason?.length > 120 ? dz.reason.slice(0, 120) + '...' : dz.reason;
                L.popup({ className: 'zekrom-popup', maxWidth: 280 })
                  .setLatLng(e.latlng)
                  .setContent(`<div style="font-family:'Inter',sans-serif;font-size:12px;line-height:1.5"><div style="font-size:11px;letter-spacing:0.5px;font-weight:700;color:${color};margin-bottom:8px">DEAD ZONE — ${dz.name}</div><div style="border-top:1px solid rgba(0,0,0,0.1);padding-top:8px;color:rgba(0,0,0,0.7)"><b>Severity:</b> ${dz.severity}<br/><b>Signal:</b> ${dz.signal_range[0]}–${dz.signal_range[1]}%<br/><b>Blackout Rate:</b> ${(dz.historical_blackout_rate * 100).toFixed(0)}%<br/><b>Avg Duration:</b> ${dz.avg_duration_minutes} min<br/><b>Confidence:</b> ${(dz.confidence_score * 100).toFixed(0)}%</div><div style="margin-top:8px;font-size:11px;color:rgba(0,0,0,0.5)">${reason}</div></div>`)
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
  return <Polyline positions={trail.map(p => [p.lat, p.lng])} pathOptions={{ color: '#6366f1', weight: 3, opacity: 0.5, dashArray: '4 4' }} />;
}

function BusPopup({ bus }) {
  const sig = bus.signal_strength ?? 85;
  const sigColor = sig >= 70 ? 'var(--signal-green)' : sig >= 40 ? 'var(--signal-amber)' : 'var(--signal-red)';
  const trafColor = bus.traffic_level === 'high' ? 'var(--signal-red)' : bus.traffic_level === 'low' ? 'var(--signal-green)' : 'var(--signal-amber)';
  const conf = bus.confidence_score ?? 0.8;
  const distKm = bus.distance_km ?? 0;
  return (
    <div style={{ width: '220px', fontSize: '13px', lineHeight: 1.5, color: 'var(--color-text)' }}>
      <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '10px', color: 'var(--color-text)' }}>
        {bus.label} <span style={{ color: 'var(--color-text-muted)', fontSize: '12px', fontWeight: 500, marginLeft: '4px' }}>{bus.route_name || bus.route_id}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}>SIGNAL</span>
        <span className="font-data-display" style={{ fontSize: '14px', color: sigColor }}>{sig}%</span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}>SPEED</span>
        <span className="font-data-display" style={{ fontSize: '14px' }}>{bus.speed_kmh?.toFixed(1) ?? '—'} <span style={{fontSize:'10px', color:'var(--color-text-muted)'}}>km/h</span></span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}>DISTANCE</span>
        <span className="font-data-display" style={{ fontSize: '14px' }}>{distKm.toFixed(1)} <span style={{fontSize:'10px', color:'var(--color-text-muted)'}}>km</span></span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}>TRAFFIC</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: trafColor }}>{(bus.traffic_level ?? 'MEDIUM').toUpperCase()}</span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}>NEXT STOP</span>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text)' }}>{bus.next_stop || '—'}</span>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}>STATUS</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: bus.is_ghost ? 'var(--signal-amber)' : 'var(--signal-green)' }}>{bus.is_ghost ? 'ESTIMATED' : 'LIVE'}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '10px', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', fontWeight: 600 }}>CONFIDENCE</span>
        <div style={{ flex: 1, height: '6px', background: 'var(--color-border-darker)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '3px', width: `${Math.round(conf * 100)}%`, background: conf >= 0.75 ? 'var(--signal-green)' : conf >= 0.5 ? 'var(--signal-amber)' : 'var(--signal-red)' }} />
        </div>
        <span className="font-data-display" style={{ fontSize: '14px', color: conf >= 0.75 ? 'var(--signal-green)' : conf >= 0.5 ? 'var(--signal-amber)' : 'var(--signal-red)' }}>{Math.round(conf * 100)}%</span>
      </div>
    </div>
  );
}

// ══ Main MapView ══
export default function MapView({ routes, buses, deadZones, mitaoe, onBusSelect, compact = false, mapId = 'live-map', showLegend = true }) {
  const center = [18.54, 73.85];
  const mitaoeIcon = useMemo(() => createMitaoeIcon(), []);

  const tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  const allStops = useMemo(() => {
    const stops = [];
    for (const [routeId, rdata] of Object.entries(routes || {})) {
      if (rdata?.stops) rdata.stops.forEach(s => stops.push({ ...s, routeId }));
    }
    return stops;
  }, [routes]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer key={mapId} center={center} zoom={13} style={{ width: '100%', height: '100%', background: '#f8fafc' }} zoomControl={!compact} attributionControl={false} id={mapId}>
        <TileLayer url={tileUrl} attribution="&copy; CARTO" />
        <FitBounds routes={routes} />

        {Object.entries(routes || {}).map(([routeId, rdata]) => {
          const bus = Object.values(buses || {}).find(b => b.route_id === routeId);
          return <SegmentedRoute key={routeId} geometry={rdata.geometry} routeProgress={bus?.route_progress ?? 0} trafficLevel={bus?.traffic_level ?? 'medium'} />;
        })}

        <DeadZoneOverlay routes={routes} deadZones={deadZones} />

        {!compact && allStops.map((stop, i) => (
          <Marker key={`stop-${i}`} position={[stop.lat, stop.lng]} icon={stopIcon}>
            <Tooltip direction="right" offset={[8, 0]} className="zekrom-tooltip">{stop.name}</Tooltip>
          </Marker>
        ))}

        {mitaoe && (
          <Marker position={[mitaoe.lat, mitaoe.lng]} icon={mitaoeIcon} zIndexOffset={200}>
            <Tooltip direction="top" offset={[0, -60]} permanent className="zekrom-tooltip">MIT ACADEMY OF ENGINEERING</Tooltip>
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
            position: 'absolute', left: '16px', top: `${16 + idx * 40}px`, zIndex: 1000,
            background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(245,158,11,0.5)',
            padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
          }}>
            <div className="signal-dot degraded" style={{ background: 'var(--signal-amber)' }} />
            <span style={{ color: 'var(--signal-amber)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>{bdata.label} — SIGNAL DEGRADED</span>
          </div>
        );
      })}
    </div>
  );
}
