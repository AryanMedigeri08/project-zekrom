/**
 * Layer5Card.jsx — Phase 8: Dead Zone Pre-awareness
 * Color: #7c3aed (deep purple)
 */

import React from 'react';
import LayerAIExplanation from './LayerAIExplanation';

const COLOR = '#7c3aed';

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Layer5Card({ layer, decisions }) {
  const { active, status, data } = layer;
  if (status === 'LOADING') return <Shell />;

  const zone = data.currentZone || data.nextZone;
  const zoneName = zone?.name || 'Unknown';

  return (
    <div className={`layer-card ${active ? 'active' : ''}`} style={{ '--layer-color': COLOR }}>
      <div className="layer-card-header">
        <span className="layer-card-icon">&#9888;&#65039;</span>
        <span className="layer-card-title">Layer 5: Dead Zone Pre-awareness</span>
        {status === 'IN ZONE' && <span className="layer-card-badge" style={{ background: '#ef4444' }}>IN ZONE</span>}
        {status === 'APPROACHING' && <span className="layer-card-badge" style={{ background: COLOR }}>APPROACHING</span>}
        {status === 'MONITORING' && <span className="layer-card-badge idle">MONITORING</span>}
      </div>

      {status === 'MONITORING' ? (
        <div className="layer-card-body idle-body">
          <div className="layer-metric-row">
            {data.nextZone ? (
              <>
                <span>Next zone: {data.nextZone.name}</span>
                <span>Distance: {data.distanceToZone != null ? `${data.distanceToZone.toFixed(1)} km` : '—'}</span>
              </>
            ) : (
              <span>No dead zones ahead on route</span>
            )}
          </div>
        </div>
      ) : status === 'APPROACHING' ? (
        <div className="layer-card-body">
          <p className="layer-trigger">Dead zone detected ahead on route.</p>

          <div className="layer-ghost-stats">
            <div className="layer-ghost-row">
              <span className="layer-ghost-label">Zone name</span>
              <span className="layer-ghost-value">{zoneName}</span>
            </div>
            <div className="layer-ghost-row">
              <span className="layer-ghost-label">Distance</span>
              <span className="layer-ghost-value">{data.distanceToZone != null ? `${data.distanceToZone.toFixed(1)} km away` : '—'}</span>
            </div>
            {zone?.historical_blackout_rate != null && (
              <div className="layer-ghost-row">
                <span className="layer-ghost-label">Historical blackout rate</span>
                <span className="layer-ghost-value">{Math.round(zone.historical_blackout_rate * 100)}%</span>
              </div>
            )}
            {zone?.avg_duration_minutes != null && (
              <div className="layer-ghost-row">
                <span className="layer-ghost-label">Avg duration</span>
                <span className="layer-ghost-value">{zone.avg_duration_minutes} min</span>
              </div>
            )}
            {zone?.confidence_score != null && (
              <div className="layer-ghost-row">
                <span className="layer-ghost-label">Confidence</span>
                <span className="layer-ghost-value">{Math.round(zone.confidence_score * 100)}%</span>
              </div>
            )}
          </div>

          <div className="layer-detail-block">
            <p className="layer-field-info" style={{ fontWeight: 600 }}>Pre-arming actions:</p>
            <p className="layer-field-info check">Ghost trajectory pre-computed</p>
            <p className="layer-field-info check">Buffer cleared and ready</p>
            <p className="layer-field-info check">ETA cone pre-widened to ±40%</p>
            <p className="layer-field-info check">Frontend warned: "Signal blackout ahead"</p>
            <p className="layer-field-info check">Position snapshot taken at max accuracy</p>
          </div>

          <p className="layer-decision">System is ready. No human intervention needed.</p>
          <LayerAIExplanation decisions={decisions} layerColor={COLOR} />
        </div>
      ) : (
        /* IN ZONE */
        <div className="layer-card-body">
          <p className="layer-trigger">Bus is inside {zoneName}.</p>

          {/* Zone progress bar */}
          <div style={{ margin: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Time in zone: {formatTime(data.timeInZone)}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: COLOR }}>
                {Math.round(data.zoneProgress ?? 0)}%
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--color-border-darker)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                width: `${data.zoneProgress ?? 0}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${COLOR}, #ef4444)`,
                borderRadius: '4px',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>

          <div className="layer-detail-block">
            <p className="layer-field-info" style={{ fontWeight: 600 }}>All pre-armed systems active:</p>
            <p className="layer-field-info check" style={{ color: '#8b5cf6' }}>Ghost bus running (Layer 3)</p>
            <p className="layer-field-info check" style={{ color: '#14b8a6' }}>Buffer filling (Layer 2)</p>
            <p className="layer-field-info check" style={{ color: '#f59e0b' }}>ETA on historical mode (Layer 4)</p>
            <p className="layer-field-info check" style={{ color: '#3b82f6' }}>Interval extended (Layer 1)</p>
          </div>

          {zone?.signal_range && (
            <p className="layer-decision">Signal in zone: {zone.signal_range[0]}–{zone.signal_range[1]}%</p>
          )}
          <LayerAIExplanation decisions={decisions} layerColor={COLOR} />
        </div>
      )}
    </div>
  );
}

function Shell() {
  return (
    <div className="layer-card" style={{ '--layer-color': COLOR }}>
      <div className="layer-card-header">
        <span className="layer-card-icon">&#9888;&#65039;</span>
        <span className="layer-card-title">Layer 5: Dead Zone Pre-awareness</span>
        <span className="layer-card-badge idle">LOADING</span>
      </div>
      <div className="layer-card-body idle-body">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Awaiting telemetry...</p>
      </div>
    </div>
  );
}
