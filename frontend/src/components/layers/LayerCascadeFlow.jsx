/**
 * LayerCascadeFlow.jsx — Phase 8: SVG cascade diagram showing inter-layer triggering.
 *
 * Layout:
 *   [L1] → [L2] → [L3]
 *                    ↓
 *   [L6] ← [L5] ← [L4]
 *
 * Each node pulses when active. Arrows animate via stroke-dashoffset.
 */

import React, { useState, useEffect, useRef } from 'react';

const LAYER_DEFS = [
  { id: 1, label: 'L1', fullLabel: 'Adaptive', color: '#3b82f6' },
  { id: 2, label: 'L2', fullLabel: 'Buffer', color: '#14b8a6' },
  { id: 3, label: 'L3', fullLabel: 'Ghost', color: '#8b5cf6' },
  { id: 4, label: 'L4', fullLabel: 'ETA', color: '#f59e0b' },
  { id: 5, label: 'L5', fullLabel: 'DeadZone', color: '#7c3aed' },
  { id: 6, label: 'L6', fullLabel: 'WebSocket', color: '#22c55e' },
];

// Node positions in SVG viewbox (400 x 100)
const POSITIONS = {
  1: { x: 50, y: 30 },
  2: { x: 170, y: 30 },
  3: { x: 290, y: 30 },
  4: { x: 290, y: 75 },
  5: { x: 170, y: 75 },
  6: { x: 50, y: 75 },
};

// Arrows (from → to)
const ARROWS = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
  { from: 3, to: 4 },
  { from: 4, to: 5 },
  { from: 5, to: 6 },
];

const R = 14; // node radius

export default function LayerCascadeFlow({ layers, cascadeInfo, activeScenario }) {
  const [cascadeStep, setCascadeStep] = useState(-1);
  const timerRef = useRef(null);
  const prevScenarioRef = useRef(null);

  // Trigger cascade animation when scenario changes
  useEffect(() => {
    if (activeScenario && activeScenario !== prevScenarioRef.current) {
      prevScenarioRef.current = activeScenario;
      const primary = cascadeInfo?.primary || [];
      if (primary.length > 0) {
        setCascadeStep(0);
        let step = 0;
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          step++;
          if (step >= primary.length) {
            clearInterval(timerRef.current);
            setCascadeStep(-1);
          } else {
            setCascadeStep(step);
          }
        }, 200);
      }
    } else if (!activeScenario) {
      prevScenarioRef.current = null;
    }
    return () => clearInterval(timerRef.current);
  }, [activeScenario, cascadeInfo]);

  const layerActive = {
    1: layers.layer1?.active,
    2: layers.layer2?.active,
    3: layers.layer3?.active,
    4: layers.layer4?.active,
    5: layers.layer5?.active,
    6: layers.layer6?.active,
  };

  // Determine which layers are in "standby" (expected to activate for scenario)
  const standbyLayers = new Set();
  if (cascadeInfo && cascadeStep >= 0) {
    const primary = cascadeInfo.primary || [];
    primary.forEach((lid, idx) => {
      if (idx > cascadeStep) standbyLayers.add(lid);
    });
  }

  // Arrow is active if both endpoints are active
  function isArrowActive(from, to) {
    return layerActive[from] && layerActive[to];
  }

  return (
    <div style={{ width: '100%', padding: '4px 0' }}>
      <svg viewBox="0 0 340 100" style={{ width: '100%', height: '80px' }} preserveAspectRatio="xMidYMid meet">
        <defs>
          {LAYER_DEFS.map(l => (
            <radialGradient key={`grad-${l.id}`} id={`cascade-grad-${l.id}`}>
              <stop offset="0%" stopColor={l.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={l.color} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>

        {/* Arrows */}
        {ARROWS.map(({ from, to }) => {
          const p1 = POSITIONS[from];
          const p2 = POSITIONS[to];
          const active = isArrowActive(from, to);
          const fromDef = LAYER_DEFS.find(l => l.id === from);

          // Compute start/end points (from edge of circle)
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / dist;
          const uy = dy / dist;
          const x1 = p1.x + ux * R;
          const y1 = p1.y + uy * R;
          const x2 = p2.x - ux * R;
          const y2 = p2.y - uy * R;
          const arrowLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

          return (
            <g key={`arrow-${from}-${to}`}>
              {/* Track line */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e2e8f0" strokeWidth="1.5" />
              {/* Active line */}
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={active ? fromDef.color : 'transparent'}
                strokeWidth="2"
                strokeDasharray={arrowLen}
                strokeDashoffset={active ? 0 : arrowLen}
                style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease' }}
              />
              {/* Arrowhead */}
              {active && (
                <polygon
                  points={`${x2},${y2} ${x2 - ux * 6 - uy * 3},${y2 - uy * 6 + ux * 3} ${x2 - ux * 6 + uy * 3},${y2 - uy * 6 - ux * 3}`}
                  fill={fromDef.color}
                  style={{ transition: 'fill 0.3s ease' }}
                />
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {LAYER_DEFS.map(l => {
          const pos = POSITIONS[l.id];
          const isActive = layerActive[l.id];
          const isStandby = standbyLayers.has(l.id);

          return (
            <g key={`node-${l.id}`}>
              {/* Pulse ring for active */}
              {isActive && (
                <circle cx={pos.x} cy={pos.y} r={R + 4} fill="none" stroke={l.color} strokeWidth="1.5" opacity="0.4">
                  <animate attributeName="r" from={R + 2} to={R + 10} dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Standby glow */}
              {isStandby && !isActive && (
                <circle cx={pos.x} cy={pos.y} r={R + 2} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
              )}

              {/* Node background */}
              <circle
                cx={pos.x} cy={pos.y} r={R}
                fill={isActive ? l.color : '#f1f5f9'}
                stroke={isActive ? l.color : isStandby ? '#f59e0b' : '#cbd5e1'}
                strokeWidth={isActive ? 2 : 1.5}
                style={{ transition: 'fill 0.3s ease, stroke 0.3s ease' }}
              />

              {/* Label */}
              <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize="9" fontWeight="700" fill={isActive ? '#fff' : '#64748b'}
                style={{ transition: 'fill 0.3s ease', fontFamily: 'Inter, sans-serif' }}
              >
                {l.label}
              </text>

              {/* Sub-label */}
              <text x={pos.x} y={pos.y > 50 ? pos.y + R + 10 : pos.y - R - 5} textAnchor="middle"
                fontSize="7" fontWeight="500" fill={isActive ? l.color : '#94a3b8'}
                style={{ transition: 'fill 0.3s ease', fontFamily: 'Inter, sans-serif' }}
              >
                {l.fullLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
