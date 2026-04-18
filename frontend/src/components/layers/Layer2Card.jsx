/**
 * Layer2Card.jsx — Phase 8: Store & Forward Buffer
 * Color: #14b8a6 (teal)
 */

import React from 'react';
import LayerAIExplanation from './LayerAIExplanation';

const COLOR = '#14b8a6';

function getBarColor(fillPct) {
  if (fillPct >= 85) return '#ef4444';
  if (fillPct >= 60) return '#f59e0b';
  return COLOR;
}

export default function Layer2Card({ layer, decisions }) {
  const { active, status, data } = layer;
  if (status === 'LOADING') return <Shell />;

  const fillPct = data.fillPercent ?? 0;
  const barColor = getBarColor(fillPct);

  return (
    <div className={`layer-card ${active ? 'active' : ''}`} style={{ '--layer-color': COLOR }}>
      <div className="layer-card-header">
        <span className="layer-card-icon">&#128190;</span>
        <span className="layer-card-title">Layer 2: Store & Forward Buffer</span>
        {status === 'FLUSHING' && <span className="layer-card-badge" style={{ background: '#22c55e' }}>FLUSHING</span>}
        {status === 'BUFFERING' && <span className="layer-card-badge" style={{ background: COLOR }}>BUFFERING</span>}
        {status === 'STANDBY' && <span className="layer-card-badge idle">STANDBY</span>}
      </div>

      {!active ? (
        <div className="layer-card-body idle-body">
          <div className="layer-metric-row">
            <span>Buffer: {data.bufferCount} / {data.bufferMax} pings</span>
            <span>Mode: Pass-through</span>
          </div>
        </div>
      ) : (
        <div className="layer-card-body">
          {status === 'BUFFERING' && (
            <>
              <p className="layer-trigger">Signal below threshold. Transmission suspended. Buffer engaged.</p>

              {/* Buffer fill bar */}
              <div className="layer-buffer-bar-container">
                <div className="layer-buffer-bar-track">
                  <div
                    className="layer-buffer-bar-fill"
                    style={{
                      width: `${fillPct}%`,
                      background: barColor,
                      transition: 'width 0.5s ease, background 0.3s ease',
                    }}
                  />
                </div>
                <span className="layer-buffer-bar-label" style={{ color: barColor }}>
                  {data.bufferCount} / {data.bufferMax}
                </span>
              </div>

              <div className="layer-detail-block">
                <p className="layer-field-info">Each ping stored with:</p>
                <p className="layer-field-info check">Full coordinates</p>
                <p className="layer-field-info check">Original timestamp</p>
                <p className="layer-field-info check">Speed + heading</p>
                <p className="layer-field-info check">Sequence number</p>
              </div>

              {fillPct >= 85 && (
                <p className="layer-warning">Near capacity! Data at risk if buffer overflows.</p>
              )}

              <p className="layer-decision">Reason: Transmitting on near-zero signal wastes battery and produces corrupted incomplete packets. Buffering preserves data integrity for flush.</p>
              <LayerAIExplanation decisions={decisions} layerColor={COLOR} />
            </>
          )}

          {status === 'FLUSHING' && (
            <>
              <p className="layer-trigger">Signal restored. Initiating flush.</p>

              <div className="layer-buffer-bar-container">
                <div className="layer-buffer-bar-track">
                  <div
                    className="layer-buffer-bar-fill"
                    style={{
                      width: `${data.flushProgress ?? 100}%`,
                      background: '#22c55e',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span className="layer-buffer-bar-label" style={{ color: '#22c55e' }}>
                  Flushing...
                </span>
              </div>

              {/* Recent pings log */}
              {(data.recentPings || []).length > 0 && (
                <div className="layer-flush-log">
                  {data.recentPings.map((p, i) => (
                    <div key={i} className="layer-flush-ping">
                      <span style={{ color: '#22c55e' }}>&#10003;</span>
                      <span>Ping {String(i + 1).padStart(3, '0')}</span>
                      <span className="monospace">{p.timestamp}</span>
                      <span className="monospace">({p.lat?.toFixed(4)}, {p.lng?.toFixed(4)})</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="layer-decision">Path reconstructed. Ghost deactivating. Map reconciling positions.</p>
              <LayerAIExplanation decisions={decisions} layerColor={COLOR} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Shell() {
  return (
    <div className="layer-card" style={{ '--layer-color': COLOR }}>
      <div className="layer-card-header">
        <span className="layer-card-icon">&#128190;</span>
        <span className="layer-card-title">Layer 2: Store & Forward Buffer</span>
        <span className="layer-card-badge idle">LOADING</span>
      </div>
      <div className="layer-card-body idle-body">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Awaiting telemetry...</p>
      </div>
    </div>
  );
}
