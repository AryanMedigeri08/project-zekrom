/**
 * MapView.jsx — Mission Control Signal Map
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import MapLegend from './MapLegend';

// ── Custom SVG bus icon ──
function createBusIcon(bus) {
  const signal = bus.signal_strength ?? 85;
  const color = signal > 70 ? '#39ff14' : signal > 40 ? '#f97316' : bus.is_ghost ? '#00f2ff' : '#ef4444';
  const opacity = bus.is_ghost ? 0.6 : 1.0;
  const dashArray = bus.is_ghost ? '4,4' : 'none';
  const label = bus.label || bus.bus_id || '?';
  const confText = bus.is_ghost && bus.ghost_confidence
    ? `<text x="26" y="20" font-family="'Space Grotesk', sans-serif" font-size="8" fill="white" text-anchor="middle" opacity="0.8">EST ${Math.round(bus.ghost_confidence * 100)}%</text>` : '';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
      <ellipse cx="26" cy="60" rx="12" ry="4" fill="rgba(0,0,0,0.5)"/>
      <path d="M26 0 C12 0 2 10 2 22 C2 38 26 58 26 58 C26 58 50 38 50 22 C50 10 40 0 26 0 Z"
            fill="rgba(0,242,255,0.1)" stroke="${color}" stroke-width="2" stroke-dasharray="${dashArray}" style="fill-opacity:0.2; filter: drop-shadow(0 0 8px ${color})"/>
      <rect x="10" y="8" width="32" height="22" rx="4" fill="${color}" opacity="${opacity}"/>
      <rect x="13" y="11" width="8" height="6" rx="1" fill="#000" opacity="0.6"/>
      <rect x="24" y="11" width="8" height="6" rx="1" fill="#000" opacity="0.6"/>
      <rect x="35" y="11" width="5" height="6" rx="1" fill="#000" opacity="0.6"/>
      <circle cx="16" cy="32" r="3" fill="#121212"/><circle cx="36" cy="32" r="3" fill="#121212"/>
      <rect x="6" y="35" width="40" height="14" rx="3" fill="#0a0a0a" opacity="0.95" stroke="${color}" stroke-width="1"/>
      <text x="26" y="45" font-family="'Space Grotesk', sans-serif" font-size="8" font-weight="700" letter-spacing="1px"
            fill="${color}" text-anchor="middle" opacity="${opacity}">${label}</text>
      ${confText}
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [52, 64], iconAnchor: [26, 58], popupAnchor: [0, -58], className: '' });
}

function createMitaoeIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">
      <ellipse cx="26" cy="60" rx="14" ry="5" fill="rgba(0,242,255,0.3)"/>
      <path d="M26 0 C12 0 2 10 2 22 C2 38 26 58 26 58 C26 58 50 38 50 22 C50 10 40 0 26 0 Z"
            fill="transparent" stroke="#00f2ff" stroke-width="2" style="filter: drop-shadow(0 0 8px #00f2ff)"/>
      <rect x="12" y="8" width="28" height="20" rx="3" fill="#fff" opacity="0.9"/>
      <rect x="14" y="10" width="10" height="8" rx="1" fill="#00f2ff" opacity="0.4"/>
      <rect x="26" y="10" width="12" height="8" rx="1" fill="#00f2ff" opacity="0.4"/>
      <rect x="6" y="32" width="40" height="14" rx="3" fill="#0a0a0a" opacity="0.9" stroke="#00f2ff" stroke-width="1"/>
      <text x="26" y="42" font-family="'Space Grotesk', sans-serif" font-size="7" font-weight="700" fill="#00f2ff" letter-spacing="1px" text-anchor="middle">MITAOE</text>
    </svg>`;
  return L.divIcon({ html: svg, iconSize: [52, 64], iconAnchor: [26, 58], className: '', popupAnchor: [0, -58] });
}

const stopIcon = new L.DivIcon({ className: '', html: '<div style="width:8px;height:8px;border-radius:50%;background:#00f2ff;box-shadow:0 0 8px #00f2ff"></div>', iconSize: [8, 8], iconAnchor: [4, 4] });

function getTrafficColor(level) {
  if (level === 'low' || level === 0) return '#39ff14';
  if (level === 'high' || level === 2) return '#ef4444';
  return '#f97316';
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
    segs.push({ positions: pts, color: behind ? 'rgba(0,242,255,0.4)' : tColor, opacity: behind ? 0.4 : 0.8, behind });
  }
  return <>{segs.map((s, i) => <Polyline key={i} positions={s.positions} pathOptions={{ color: s.color, weight: 4, opacity: s.opacity, lineCap: 'round', className: s.behind ? '' : 'glow-cyan' }} />)}</>;
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
        const color = isBlackout ? '#f97316' : '#eab308';
        const dashArray = isBlackout ? '8 6' : '3 4';
        return segments.map((seg, i) => (
          <Polyline key={`${dz.zone_id}-${i}`} positions={[seg.from, seg.to]}
            pathOptions={{ color, weight: 6, opacity: 0.6, dashArray }}
            eventHandlers={{
              mouseover: (e) => {
                const reason = dz.reason?.length > 120 ? dz.reason.slice(0, 120) + '...' : dz.reason;
                L.popup({ className: 'zekrom-popup', maxWidth: 280 })
                  .setLatLng(e.latlng)
                  .setContent(`<div style="font-family:'Inter',sans-serif;font-size:12px;line-height:1.5"><div style="font-family:'Space Grotesk',sans-serif;font-size:10px;letter-spacing:1px;font-weight:700;color:${color};margin-bottom:6px;text-shadow:0 0 8px ${color}">DEAD ZONE — ${dz.name}</div><div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;color:#b9cacb"><b>Severity:</b> ${dz.severity}<br/><b>Signal:</b> ${dz.signal_range[0]}–${dz.signal_range[1]}%<br/><b>Blackout Rate:</b> ${(dz.historical_blackout_rate * 100).toFixed(0)}%<br/><b>Avg Duration:</b> ${dz.avg_duration_minutes} min<br/><b>Confidence:</b> ${(dz.confidence_score * 100).toFixed(0)}%</div><div style="margin-top:6px;font-size:11px;color:#849495">${reason}</div></div>`)
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
  return <Polyline positions={trail.map(p => [p.lat, p.lng])} pathOptions={{ color: '#00f2ff', weight: 2, opacity: 0.4, dashArray: '4 4' }} />;
}

function BusPopup({ bus }) {
  const sig = bus.signal_strength ?? 85;
  const sigColor = sig >= 70 ? 'var(--signal-green)' : sig >= 40 ? 'var(--signal-amber)' : 'var(--signal-red)';
  const trafColor = bus.traffic_level === 'high' ? 'var(--signal-red)' : bus.traffic_level === 'low' ? 'var(--signal-green)' : 'var(--signal-amber)';
  const conf = bus.confidence_score ?? 0.8;
  return (
    <div style={{ width: '220px', fontSize: '13px', lineHeight: 1.5, color: 'var(--color-text)' }}>
      <div className="font-data-display" style={{ fontSize: '16px', marginBottom: '8px', color: 'var(--signal-cyan)' }}>
        {bus.label} <span className="font-label-caps" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>{bus.route_name || bus.route_id}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
        <span className="font-label-caps" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>SIGNAL</span>
        <span className="font-data-display" style={{ fontSize: '14px', color: sigColor, textShadow: `0 0 8px ${sigColor}80` }}>{sig}%</span>
        <span className="font-label-caps" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>SPEED</span>
        <span className="font-data-display" style={{ fontSize: '14px' }}>{bus.speed_kmh?.toFixed(1) ?? '—'} <span style={{fontSize:'10px', color:'var(--color-text-muted)'}}>km/h</span></span>
        <span className="font-label-caps" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>TRAFFIC</span>
        <span className="font-label-caps" style={{ color: trafColor }}>{bus.traffic_level ?? 'MEDIUM'}</span>
        <span className="font-label-caps" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>NEXT STOP</span>
        <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--signal-cyan)' }}>{bus.next_stop || '—'}</span>
        <span className="font-label-caps" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>STATUS</span>
        <span className="font-label-caps" style={{ color: bus.is_ghost ? 'var(--signal-amber)' : 'var(--signal-green)' }}>{bus.is_ghost ? 'ESTIMATED' : 'LIVE'}</span>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)', marginTop: '8px', paddingTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="font-label-caps" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>CONFIDENCE</span>
        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: '2px', width: `${Math.round(conf * 100)}%`, background: conf >= 0.75 ? 'var(--signal-green)' : conf >= 0.5 ? 'var(--signal-amber)' : 'var(--signal-red)' }} />
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

  const tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

  const allStops = useMemo(() => {
    const stops = [];
    for (const [routeId, rdata] of Object.entries(routes || {})) {
      if (rdata?.stops) rdata.stops.forEach(s => stops.push({ ...s, routeId }));
    }
    return stops;
  }, [routes]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer key={mapId} center={center} zoom={12} style={{ width: '100%', height: '100%', background: '#0a0a0a' }} zoomControl={!compact} attributionControl={false} id={mapId}>
        <TileLayer url={tileUrl} attribution="&copy; CARTO" />
        <FitBounds routes={routes} />

        {Object.entries(routes || {}).map(([routeId, rdata]) => {
          const bus = Object.values(buses || {}).find(b => b.route_id === routeId);
          return <SegmentedRoute key={routeId} geometry={rdata.geometry} busGeometryIndex={bus?.geometry_index ?? 0} trafficLevel={bus?.traffic_level ?? 'medium'} />;
        })}

        <DeadZoneOverlay routes={routes} deadZones={deadZones} />

        {!compact && allStops.map((stop, i) => (
          <Marker key={`stop-${i}`} position={[stop.lat, stop.lng]} icon={stopIcon}>
            <Tooltip direction="right" offset={[8, 0]} className="zekrom-tooltip font-label-caps">{stop.name}</Tooltip>
          </Marker>
        ))}

        {mitaoe && (
          <Marker position={[mitaoe.lat, mitaoe.lng]} icon={mitaoeIcon} zIndexOffset={200}>
            <Tooltip direction="top" offset={[0, -60]} permanent className="zekrom-tooltip font-label-caps glow-cyan">MIT ACADEMY OF ENGINEERING</Tooltip>
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
          <div key={busId} className="font-label-caps" style={{
            position: 'absolute', left: '16px', top: `${16 + idx * 40}px`, zIndex: 1000,
            background: 'rgba(249,115,22,0.1)', border: '1px solid var(--signal-amber)',
            padding: '6px 16px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '10px',
            backdropFilter: 'blur(8px)', boxShadow: '0 0 15px rgba(249,115,22,0.3)'
          }}>
            <div className="signal-dot" style={{ background: 'var(--signal-amber)', boxShadow: '0 0 8px var(--signal-amber)', animation: 'signal-blink 1.5s infinite'}} />
            <span style={{ color: 'var(--signal-amber)', fontSize: '11px', letterSpacing: '1px' }}>{bdata.label} — SIGNAL DEGRADED</span>
          </div>
        );
      })}
    </div>
  );
}
