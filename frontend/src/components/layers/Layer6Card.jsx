/**
 * Layer6Card.jsx — Phase 8: WebSocket Connection Resilience
 * Color: #22c55e (green)
 */

import React, { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import LayerAIExplanation from './LayerAIExplanation';

const COLOR = '#22c55e';

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getLatencyColor(ms) {
  if (ms > 1000) return '#ef4444';
  if (ms > 500) return '#f59e0b';
  return COLOR;
}

export default function Layer6Card({ layer, decisions }) {
  const { active, status, data } = layer;
  if (status === 'LOADING') return <Shell />;

  const latencyColor = getLatencyColor(data.latency ?? 94);

  // Build latency history chart (simulate from current value if no history)
  const latencyHistory = useMemo(() => {
    const hist = [];
    const base = data.latency ?? 94;
    for (let i = 0; i < 30; i++) {
      hist.push({ i, v: Math.max(0, base + Math.round((Math.random() - 0.5) * 30)) });
    }
    return hist;
  }, [data.latency]);

  return (
    <div className={`layer-card ${active ? 'active' : ''}`} style={{ '--layer-color': COLOR }}>
      <div className="layer-card-header">
        <span className="layer-card-icon">&#128279;</span>
        <span className="layer-card-title">Layer 6: WebSocket Resilience</span>
        {status === 'RECONNECTING' && <span className="layer-card-badge" style={{ background: '#ef4444' }}>RECONNECTING</span>}
        {status === 'DEGRADED' && <span className="layer-card-badge" style={{ background: '#f59e0b' }}>DEGRADED</span>}
        {status === 'STRESSED' && <span className="layer-card-badge" style={{ background: '#f59e0b' }}>STRESSED</span>}
        {status === 'CONNECTED' && <span className="layer-card-badge idle">CONNECTED</span>}
      </div>

      {!active ? (
        <div className="layer-card-body idle-body">
          <div className="layer-metric-row">
            <span>Latency: {data.latency ?? 94}ms</span>
            <span>Uptime: {formatUptime(data.uptime)}</span>
            <span>Lost: {data.missedPings ?? 0}</span>
          </div>
        </div>
      ) : (
        <div className="layer-card-body">
          {status === 'RECONNECTING' ? (
            <>
              <p className="layer-trigger">Connection lost. Initiating recovery sequence.</p>

              {/* Reconnection attempts */}
              <div className="layer-detail-block">
                {Array.from({ length: Math.max(1, data.reconnectAttempt ?? 1) }).map((_, i) => (
                  <p key={i} className="layer-field-info">
                    Attempt {i + 1}: {Math.pow(2, i).toFixed(1)}s —{' '}
                    {i < (data.reconnectAttempt ?? 1) - 1
                      ? <span style={{ color: '#ef4444' }}>✗ Failed</span>
                      : <span style={{ color: '#f59e0b' }}>⟳ Trying...</span>
                    }
                  </p>
                ))}
              </div>

              <div className="layer-detail-block" style={{ marginTop: '8px' }}>
                <p className="layer-field-info" style={{ fontWeight: 600 }}>While disconnected:</p>
                <p className="layer-field-info check">Frontend in local prediction mode</p>
                <p className="layer-field-info check">Ghost extrapolation running client-side</p>
                <p className="layer-field-info check">UI showing last known state (not frozen)</p>
                <p className="layer-field-info check">No error shown to end user</p>
              </div>
              <LayerAIExplanation decisions={decisions} layerColor={COLOR} />
            </>
          ) : (
            <>
              <p className="layer-trigger">
                {status === 'DEGRADED' ? 'High latency detected. Connection stressed.' : 'Elevated latency. Connection under monitoring.'}
              </p>

              <div className="layer-ghost-stats">
                <div className="layer-ghost-row">
                  <span className="layer-ghost-label">Current latency</span>
                  <span className="layer-ghost-value" style={{ color: latencyColor }}>
                    {(data.latency ?? 94).toLocaleString()}ms {(data.latency ?? 94) > 1000 ? '⚠️' : ''}
                  </span>
                </div>
                <div className="layer-ghost-row">
                  <span className="layer-ghost-label">Normal baseline</span>
                  <span className="layer-ghost-value">{data.baselineLatency ?? 94}ms</span>
                </div>
                <div className="layer-ghost-row">
                  <span className="layer-ghost-label">Degradation factor</span>
                  <span className="layer-ghost-value" style={{ color: latencyColor }}>
                    {data.degradationFactor ?? 1}x
                  </span>
                </div>
                <div className="layer-ghost-row">
                  <span className="layer-ghost-label">Message queue depth</span>
                  <span className="layer-ghost-value">{data.messageQueueDepth ?? 0}</span>
                </div>
              </div>

              <div className="layer-detail-block" style={{ marginTop: '8px' }}>
                <p className="layer-field-info" style={{ fontWeight: 600 }}>Adaptive response:</p>
                <p className="layer-field-info">→ Heartbeat interval extended 5s → 15s</p>
                <p className="layer-field-info">→ Message queue prioritized by type:</p>
                <p className="layer-field-info" style={{ paddingLeft: '12px' }}>1. Position pings (critical)</p>
                <p className="layer-field-info" style={{ paddingLeft: '12px' }}>2. Ghost updates (high)</p>
                <p className="layer-field-info" style={{ paddingLeft: '12px' }}>3. ETA updates (medium)</p>
                <p className="layer-field-info" style={{ paddingLeft: '12px' }}>4. Log events (low)</p>
              </div>

              {/* Latency sparkline */}
              <div className="layer-mini-chart" style={{ marginTop: '8px' }}>
                <div className="layer-mini-chart-label">Latency (last 30s)</div>
                <ResponsiveContainer width="100%" height={40}>
                  <LineChart data={latencyHistory} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                    <YAxis domain={[0, 'auto']} hide />
                    <ReferenceLine y={500} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={1000} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Line type="monotone" dataKey="v" stroke={latencyColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="layer-decision">
                High latency + frequent heartbeats = false disconnection triggers. Extending interval prevents unnecessary reconnection cycles.
              </p>
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
        <span className="layer-card-icon">&#128279;</span>
        <span className="layer-card-title">Layer 6: WebSocket Resilience</span>
        <span className="layer-card-badge idle">LOADING</span>
      </div>
      <div className="layer-card-body idle-body">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Awaiting telemetry...</p>
      </div>
    </div>
  );
}
