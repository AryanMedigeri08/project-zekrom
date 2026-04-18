/**
 * Layer3Card.jsx — Phase 8: Ghost Bus Extrapolation
 * Color: #8b5cf6 (purple)
 */

import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import LayerAIExplanation from './LayerAIExplanation';

const COLOR = '#8b5cf6';

function formatElapsed(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getDeviationColor(m) {
  if (m == null) return 'var(--color-text-muted)';
  if (m < 50) return '#22c55e';
  if (m < 150) return '#f59e0b';
  return '#ef4444';
}

export default function Layer3Card({ layer, decisions }) {
  const { active, status, data } = layer;
  if (status === 'LOADING') return <Shell />;

  // Build confidence chart data
  const confHistory = (data.confidenceHistory || []).map((v, i) => ({
    i,
    v: Math.round(v * 100),
  }));

  const confColor = (data.confidence ?? 1) >= 0.7 ? '#22c55e' : (data.confidence ?? 1) >= 0.4 ? '#f59e0b' : '#ef4444';

  return (
    <div className={`layer-card ${active ? 'active' : ''}`} style={{ '--layer-color': COLOR }}>
      <div className="layer-card-header">
        <span className="layer-card-icon">&#128123;</span>
        <span className="layer-card-title">Layer 3: Ghost Bus Extrapolation</span>
        {status === 'RECONCILING' && <span className="layer-card-badge" style={{ background: '#22c55e' }}>RECONCILING</span>}
        {status === 'ACTIVE' && <span className="layer-card-badge" style={{ background: COLOR }}>ACTIVE</span>}
        {status === 'INACTIVE' && <span className="layer-card-badge idle">INACTIVE</span>}
      </div>

      {status === 'INACTIVE' ? (
        <div className="layer-card-body idle-body">
          <div className="layer-metric-row">
            <span>Last real ping: {data.timeSinceRealPing ? `${data.timeSinceRealPing}s ago` : '0.8s ago'}</span>
            <span>Confidence: —</span>
          </div>
        </div>
      ) : status === 'RECONCILING' ? (
        <div className="layer-card-body">
          <p className="layer-trigger">Real pings restored. Comparing positions.</p>

          <div className="layer-detail-block">
            <p className="layer-field-info">
              Deviation: <span style={{ fontWeight: 700, color: getDeviationColor(data.deviation) }}>
                ~{data.deviation != null ? `${Math.round(data.deviation)}m` : '—'}
              </span>
              {data.deviationLabel && (
                <span style={{ marginLeft: '8px', color: getDeviationColor(data.deviation) }}>
                  {data.deviation < 50 ? '✓' : data.deviation < 150 ? '~' : '✗'} {data.deviationLabel}
                </span>
              )}
            </p>
          </div>

          <p className="layer-decision">Ghost deactivated. Live mode resumed.</p>
          <LayerAIExplanation decisions={decisions} layerColor={COLOR} />
        </div>
      ) : (
        <div className="layer-card-body">
          <p className="layer-trigger">Real signal lost. Virtual replica active.</p>

          <div className="layer-ghost-stats">
            <div className="layer-ghost-row">
              <span className="layer-ghost-label">Time since last real ping</span>
              <span className="layer-ghost-value">{formatElapsed(data.timeSinceRealPing)}</span>
            </div>
            <div className="layer-ghost-row">
              <span className="layer-ghost-label">Last known speed</span>
              <span className="layer-ghost-value">{(data.lastSpeed ?? 0).toFixed(1)} km/h</span>
            </div>
            <div className="layer-ghost-row">
              <span className="layer-ghost-label">Last known heading</span>
              <span className="layer-ghost-value">{(data.lastHeading ?? 0).toFixed(1)}°</span>
            </div>
            <div className="layer-ghost-row">
              <span className="layer-ghost-label">Extrapolation method</span>
              <span className="layer-ghost-value">Road geometry snap</span>
            </div>
            <div className="layer-ghost-row">
              <span className="layer-ghost-label">Ghost has moved</span>
              <span className="layer-ghost-value">{(data.distanceTraveled ?? 0).toFixed(2)} km</span>
            </div>
          </div>

          {/* Confidence decay bar */}
          <div style={{ margin: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Confidence decay:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: confColor }}>{Math.round((data.confidence ?? 1) * 100)}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'var(--color-border-darker)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round((data.confidence ?? 1) * 100)}%`,
                height: '100%',
                background: confColor,
                borderRadius: '3px',
                transition: 'width 0.5s ease, background 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Decaying at 5% per 30 seconds</div>
          </div>

          {/* Confidence history chart */}
          {confHistory.length > 2 && (
            <div className="layer-mini-chart">
              <div className="layer-mini-chart-label">Confidence over time</div>
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={confHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <YAxis domain={[0, 100]} hide />
                  <Line type="monotone" dataKey="v" stroke={confColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="layer-decision">
            Position computed every 2s using: distance = (speed / 3600) x elapsed. Advanced along route geometry, snapped to nearest road point.
          </p>
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
        <span className="layer-card-icon">&#128123;</span>
        <span className="layer-card-title">Layer 3: Ghost Bus Extrapolation</span>
        <span className="layer-card-badge idle">LOADING</span>
      </div>
      <div className="layer-card-body idle-body">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Awaiting telemetry...</p>
      </div>
    </div>
  );
}
