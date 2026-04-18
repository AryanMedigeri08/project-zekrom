/**
 * Layer1Card.jsx — Phase 8: Adaptive Payload & Frequency
 * Color: #3b82f6 (blue)
 */

import React from 'react';
import { BarChart, Bar, ResponsiveContainer } from 'recharts';
import LayerAIExplanation from './LayerAIExplanation';

const COLOR = '#3b82f6';

function formatMs(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(0)}s` : `${ms}ms`;
}

export default function Layer1Card({ layer, decisions }) {
  const { active, status, data } = layer;
  if (status === 'LOADING') return <LayerShell label="Layer 1: Adaptive Transmission" color={COLOR} status="LOADING" />;

  const chartData = (data.payloadHistory || []).map((v, i) => ({ i, v }));

  return (
    <div className={`layer-card ${active ? 'active' : ''}`} style={{ '--layer-color': COLOR }}>
      <div className="layer-card-header">
        <span className="layer-card-icon">&#128225;</span>
        <span className="layer-card-title">Layer 1: Adaptive Transmission</span>
        {active && <span className="layer-card-badge" style={{ background: COLOR }}>ACTIVE</span>}
        {!active && <span className="layer-card-badge idle">NOMINAL</span>}
      </div>

      {!active ? (
        <div className="layer-card-body idle-body">
          <div className="layer-metric-row">
            <span>Ping interval: {formatMs(data.pingInterval)}</span>
            <span>Payload: {data.payloadSize}B</span>
            <span>Mode: {data.payloadMode || 'Full'}</span>
          </div>
        </div>
      ) : (
        <div className="layer-card-body">
          <p className="layer-trigger">
            Signal {data.trend === 'degrading' ? 'dropped' : 'changed'} to {data.signal}%
            {data.prevSignal != null && ` (from ${data.prevSignal}%)`}
          </p>
          <p className="layer-reason">Recalculating optimal transmission params...</p>

          <div className="layer-transition-grid">
            <div className="layer-transition-row">
              <span className="layer-transition-label">Ping Interval</span>
              <span className="layer-transition-old">{formatMs(data.prevPingInterval)}</span>
              <span className="layer-transition-arrow">→</span>
              <span className="layer-transition-new">{formatMs(data.pingInterval)}</span>
              <span className="layer-transition-dir">{data.pingInterval > data.prevPingInterval ? '↑ conserving' : '↓ aggressive'}</span>
            </div>
            <div className="layer-transition-row">
              <span className="layer-transition-label">Payload Size</span>
              <span className="layer-transition-old">{data.prevPayloadSize}B</span>
              <span className="layer-transition-arrow">→</span>
              <span className="layer-transition-new">{data.payloadSize}B</span>
              <span className="layer-transition-dir">{data.payloadSize < data.prevPayloadSize ? '↓ compressed' : '↑ expanded'}</span>
            </div>
          </div>

          <div className="layer-detail-block">
            <p className="layer-field-info">Fields Dropped: {data.fieldsDropped}</p>
            <p className="layer-field-info">Fields Kept: {data.fieldsKept}</p>
            <p className="layer-field-info highlight">Bandwidth saved: ~{data.bandwidthSaved}%</p>
          </div>

          <p className="layer-decision">
            Decision: {data.trend === 'degrading'
              ? 'Extend interval to preserve connection stability. High latency + frequent pings = packet collision. Sparse reliable > dense lossy.'
              : 'Signal recovering. Gradually restoring full payload and tighter intervals.'}
          </p>

          {/* Mini payload chart */}
          {chartData.length > 0 && (
            <div className="layer-mini-chart">
              <div className="layer-mini-chart-label">Payload size (last 20 pings)</div>
              <ResponsiveContainer width="100%" height={50}>
                <BarChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <Bar dataKey="v" fill={COLOR} fillOpacity={0.6} isAnimationActive={false} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="layer-metric-row small">
            <span>{data.bytesPerSecond ?? 0} B/s transmitted</span>
          </div>
          <LayerAIExplanation decisions={decisions} layerColor={COLOR} />
        </div>
      )}
    </div>
  );
}

function LayerShell({ label, color, status }) {
  return (
    <div className="layer-card" style={{ '--layer-color': color }}>
      <div className="layer-card-header">
        <span className="layer-card-title">{label}</span>
        <span className="layer-card-badge idle">{status}</span>
      </div>
      <div className="layer-card-body idle-body">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Awaiting telemetry...</p>
      </div>
    </div>
  );
}
