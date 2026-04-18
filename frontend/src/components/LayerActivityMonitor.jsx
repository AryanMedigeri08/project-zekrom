/**
 * LayerActivityMonitor.jsx — Phase 8: Main container for the 6-layer activity panel.
 *
 * Contains:
 * - Header with monitored bus selector
 * - Scenario cascade banner
 * - LayerCascadeFlow SVG diagram
 * - 6 stacked layer cards (each with AI Explanations)
 * - Polls /api/system-log for simulation AI decisions per layer
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import useLayerActivity, { SCENARIO_CASCADES } from '../hooks/useLayerActivity';
import LayerCascadeFlow from './layers/LayerCascadeFlow';
import Layer1Card from './layers/Layer1Card';
import Layer2Card from './layers/Layer2Card';
import Layer3Card from './layers/Layer3Card';
import Layer4Card from './layers/Layer4Card';
import Layer5Card from './layers/Layer5Card';
import Layer6Card from './layers/Layer6Card';

const API_BASE = 'http://localhost:8000';

const BUS_OPTIONS = [
  { id: null, label: 'Auto (Most Critical)' },
  { id: 'bus_01', label: 'MIT-01' },
  { id: 'bus_02', label: 'HIN-02' },
  { id: 'bus_03', label: 'HAD-03' },
  { id: 'bus_04', label: 'KAT-04' },
  { id: 'bus_05', label: 'PUN-05' },
];

// Maps AI decision types to their relevant layer numbers
const DECISION_LAYER_MAP = {
  'Ping Interval Adjusted': 1,
  'Adaptive Transmission': 1,
  'Buffer Flush Executed': 2,
  'Buffer Engaged': 2,
  'Ghost Bus Activated': 3,
  'Ghost Deactivated': 3,
  'ETA Recalculated': 4,
  'ETA Updated': 4,
  'Dead Zone Entry': 5,
  'Dead Zone Exit': 5,
  'Dead Zone Approaching': 5,
  'Connection Degraded': 6,
  'WebSocket Reconnecting': 6,
  'Signal Restored': 3,
};

function classifyDecision(decision) {
  if (!decision?.explanation?.decision) return null;
  const d = decision.explanation.decision;
  for (const [key, layer] of Object.entries(DECISION_LAYER_MAP)) {
    if (d.includes(key) || d.toLowerCase().includes(key.toLowerCase())) return layer;
  }
  // Fallback heuristics
  if (d.toLowerCase().includes('ghost')) return 3;
  if (d.toLowerCase().includes('buffer') || d.toLowerCase().includes('flush')) return 2;
  if (d.toLowerCase().includes('eta')) return 4;
  if (d.toLowerCase().includes('dead zone') || d.toLowerCase().includes('zone')) return 5;
  if (d.toLowerCase().includes('interval') || d.toLowerCase().includes('payload') || d.toLowerCase().includes('signal')) return 1;
  if (d.toLowerCase().includes('websocket') || d.toLowerCase().includes('connection')) return 6;
  return null;
}

export default function LayerActivityMonitor({ buses, simConfig, activeScenario }) {
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [layerDecisions, setLayerDecisions] = useState({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
  const seenRef = useRef(new Set());

  const layerData = useLayerActivity(buses, simConfig, selectedBusId, activeScenario);
  const { monitoredBusId, monitoredBus, cascadeInfo, layer1, layer2, layer3, layer4, layer5, layer6 } = layerData;

  const layers = { layer1, layer2, layer3, layer4, layer5, layer6 };
  const activeCount = [layer1, layer2, layer3, layer4, layer5, layer6].filter(l => l.active).length;
  const busLabel = monitoredBus?.label || monitoredBusId || '—';

  // Poll for AI decisions (simulation-only)
  const pollDecisions = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/system-log`);
      if (!resp.ok) return;
      const data = await resp.json();

      // Filter for simulation decisions only
      const simDecisions = data.filter(e => e.is_simulated && e.explanation);

      // If monitoring a specific bus, filter by bus_id
      const filtered = monitoredBusId
        ? simDecisions.filter(e => !e.explanation?.bus_id || e.explanation.bus_id === monitoredBusId)
        : simDecisions;

      const newLayerDecisions = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

      filtered.forEach(d => {
        const layerNum = classifyDecision(d);
        if (layerNum && newLayerDecisions[layerNum]) {
          const key = `${d.timestamp}-${d.explanation?.decision}`;
          newLayerDecisions[layerNum].push({
            ...d,
            _key: key,
            isNew: !seenRef.current.has(key),
          });
          seenRef.current.add(key);
        }
      });

      // Keep last 3 per layer
      for (const k of Object.keys(newLayerDecisions)) {
        newLayerDecisions[k] = newLayerDecisions[k].slice(-3);
      }

      setLayerDecisions(newLayerDecisions);
    } catch { /* silent */ }
  }, [monitoredBusId]);

  useEffect(() => {
    pollDecisions();
    const iv = setInterval(pollDecisions, 3000);
    return () => clearInterval(iv);
  }, [pollDecisions]);

  return (
    <div className="glass-card" style={{
      display: 'flex', flexDirection: 'column', overflow: 'visible', padding: 0,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.2px' }}>
            ⚡ Layer Activity Monitor
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Monitoring: <span style={{ fontWeight: 700, color: 'var(--signal-cyan)' }}>{busLabel}</span>
            <span style={{ marginLeft: '8px', color: 'var(--color-text-muted)' }}>
              {activeCount}/6 active
            </span>
          </div>
        </div>

        {/* Bus selector dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
              border: '1px solid var(--color-border)', cursor: 'pointer',
              background: 'rgba(255,255,255,0.5)', color: 'var(--color-text-secondary)',
            }}
          >
            change ▼
          </button>
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '4px',
              background: '#fff', border: '1px solid var(--color-border)',
              borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              zIndex: 100, overflow: 'hidden', minWidth: '160px',
            }}>
              {BUS_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => { setSelectedBusId(opt.id); setDropdownOpen(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '8px 14px',
                    fontSize: '12px', fontWeight: selectedBusId === opt.id ? 700 : 500,
                    color: selectedBusId === opt.id ? 'var(--signal-cyan)' : 'var(--color-text)',
                    background: selectedBusId === opt.id ? 'rgba(99,102,241,0.06)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Scenario banner ── */}
      {cascadeInfo && (
        <div style={{
          padding: '8px 16px', flexShrink: 0,
          background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)',
          fontSize: '11px', fontWeight: 600, color: '#b45309',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>▶</span>
          <span>SCENARIO: {activeScenario?.replace(/_/g, ' ').toUpperCase()}</span>
          <span style={{ color: '#92400e' }}>— {cascadeInfo.label}</span>
        </div>
      )}

      {/* ── Cascade Flow ── */}
      <div style={{ padding: '4px 12px', flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
        <LayerCascadeFlow layers={layers} cascadeInfo={cascadeInfo} activeScenario={activeScenario} />
      </div>

      {/* ── Layer Cards (expanded, no internal scroll) ── */}
      <div style={{
        padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        <Layer1Card layer={layer1} decisions={layerDecisions[1]} />
        <Layer2Card layer={layer2} decisions={layerDecisions[2]} />
        <Layer3Card layer={layer3} decisions={layerDecisions[3]} />
        <Layer4Card layer={layer4} decisions={layerDecisions[4]} />
        <Layer5Card layer={layer5} decisions={layerDecisions[5]} />
        <Layer6Card layer={layer6} decisions={layerDecisions[6]} />
      </div>
    </div>
  );
}
