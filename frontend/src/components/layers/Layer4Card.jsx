/**
 * Layer4Card.jsx — Phase 8: ML ETA Prediction Engine
 * Color: #f59e0b (amber)
 */

import React from 'react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Cell } from 'recharts';
import LayerAIExplanation from './LayerAIExplanation';

const COLOR = '#f59e0b';

const TRAFFIC_LABELS = ['Low', 'Medium', 'High'];
const WEATHER_LABELS = ['Clear', 'Cloudy', 'Storm'];
const DATA_MODE_COLORS = { live: '#22c55e', hybrid: '#f59e0b', historical: '#ef4444' };

export default function Layer4Card({ layer, decisions }) {
  const { active, status, data } = layer;
  if (status === 'LOADING') return <Shell />;

  const featureData = (data.featureImportance || []).map(f => ({
    name: f.feature.replace(/_/g, ' '),
    weight: f.weight,
  }));

  const modeColor = DATA_MODE_COLORS[data.dataMode] || '#6366f1';
  const coneLabel = (data.coneWidth || 'narrow').toUpperCase();
  const traffic = TRAFFIC_LABELS[data.trafficLevel ?? 1] || 'Medium';
  const weather = WEATHER_LABELS[data.weather ?? 0] || 'Clear';
  const depHour = new Date().getHours();
  const dayOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(new Date().getDay() + 6) % 7];

  return (
    <div className={`layer-card ${active ? 'active' : ''}`} style={{ '--layer-color': COLOR }}>
      <div className="layer-card-header">
        <span className="layer-card-icon">&#129504;</span>
        <span className="layer-card-title">Layer 4: ML ETA Prediction</span>
        {active && <span className="layer-card-badge" style={{ background: COLOR }}>COMPUTING</span>}
        {!active && <span className="layer-card-badge idle">RUNNING</span>}
      </div>

      {!active ? (
        <div className="layer-card-body idle-body">
          <div className="layer-metric-row">
            <span>Model: GradientBoosting v1</span>
            <span>Cone: {coneLabel}</span>
            <span style={{ color: modeColor, fontWeight: 600 }}>{(data.dataMode || 'live').toUpperCase()}</span>
          </div>
        </div>
      ) : (
        <div className="layer-card-body">
          <p className="layer-trigger">
            ETA recalculation triggered.
            {data.signal < 40 && ` Signal penalty applied (${data.signal}%).`}
          </p>

          {/* Model inputs table */}
          <div className="layer-inputs-table">
            <div className="layer-input-row">
              <span>departure_time</span><span>{depHour} ({depHour < 12 ? 'AM' : 'PM'})</span>
            </div>
            <div className="layer-input-row">
              <span>day_of_week</span><span>{(new Date().getDay() + 6) % 7} ({dayOfWeek})</span>
            </div>
            <div className="layer-input-row">
              <span>traffic_level</span><span>{data.trafficLevel ?? 1} ({traffic})</span>
            </div>
            <div className="layer-input-row">
              <span>avg_signal</span>
              <span style={{ color: data.signal < 40 ? '#ef4444' : 'var(--color-text)' }}>
                {data.signal ?? 85}%{data.signal < 70 ? ' ← penalized' : ''}
              </span>
            </div>
            <div className="layer-input-row">
              <span>weather</span><span>{data.weather ?? 0} ({weather})</span>
            </div>
          </div>

          {/* Confidence + data mode */}
          <div className="layer-metric-row" style={{ marginTop: '8px' }}>
            <span>Confidence: <strong>{Math.round((data.confidence ?? 0.8) * 100)}%</strong></span>
            <span>Cone width: <strong style={{ color: data.coneWidth === 'narrow' ? '#22c55e' : data.coneWidth === 'medium' ? '#f59e0b' : '#ef4444' }}>
              {coneLabel}
            </strong></span>
            <span style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
              background: `${modeColor}15`, color: modeColor, border: `1px solid ${modeColor}40`,
            }}>
              {(data.dataMode || 'live').toUpperCase()}
            </span>
          </div>

          {/* Feature importance chart */}
          {featureData.length > 0 && (
            <div className="layer-mini-chart" style={{ marginTop: '8px' }}>
              <div className="layer-mini-chart-label">Feature importance</div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={featureData} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 80 }}>
                  <XAxis type="number" domain={[0, 0.4]} hide />
                  <Bar dataKey="weight" isAnimationActive={false} radius={[0, 3, 3, 0]}>
                    {featureData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? COLOR : `${COLOR}${Math.round(255 * (1 - i * 0.15)).toString(16).padStart(2, '0')}`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Labels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', marginTop: '-80px', marginBottom: '4px', position: 'relative', zIndex: 2 }}>
                {featureData.map((f, i) => (
                  <div key={i} style={{ height: '16px', display: 'flex', alignItems: 'center', paddingLeft: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                      {f.name} ({f.weight.toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="layer-decision">
            Data mode: {data.dataMode === 'hybrid'
              ? 'Live pings sparse — weighting historical pattern data 60% / live data 40%.'
              : data.dataMode === 'historical'
              ? 'Ghost mode active — relying on historical model predictions.'
              : 'All inputs from live pings. Full confidence.'}
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
        <span className="layer-card-icon">&#129504;</span>
        <span className="layer-card-title">Layer 4: ML ETA Prediction</span>
        <span className="layer-card-badge idle">LOADING</span>
      </div>
      <div className="layer-card-body idle-body">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>Awaiting telemetry...</p>
      </div>
    </div>
  );
}
