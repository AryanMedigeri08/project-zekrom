/**
 * AIDecisionLog.jsx — Mission Control System Intel Panel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNotifications } from '../context/NotificationContext';

const API_BASE = 'http://localhost:8000';

const BORDER_COLORS = {
  'Ghost Bus Activated': 'var(--signal-amber)',
  'Buffer Flush Executed': 'var(--signal-green)',
  'Ping Interval Adjusted': 'var(--signal-cyan)',
  'ETA Recalculated': 'var(--signal-cyan)',
  'Dead Zone Entry': 'var(--signal-red)',
};

const BG_DARK = {
  'Ghost Bus Activated': 'rgba(249,115,22,0.1)',
  'Buffer Flush Executed': 'rgba(57,255,20,0.1)',
  'Ping Interval Adjusted': 'rgba(0,242,255,0.1)',
  'ETA Recalculated': 'rgba(0,242,255,0.1)',
  'Dead Zone Entry': 'rgba(239,68,68,0.1)',
};

function isRecent(timestamp) {
  if (!timestamp) return false;
  const now = new Date();
  const [h, m, s] = timestamp.split(':').map(Number);
  const entryDate = new Date();
  entryDate.setHours(h, m, s, 0);
  return (now - entryDate) < 10000;
}

export default function AIDecisionLog({ busFilter }) {
  const { addNotification } = useNotifications();
  const [entries, setEntries] = useState([]);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [sortAsc, setSortAsc] = useState(false); // false = newest first
  const seenIdsRef = React.useRef(new Set());

  const poll = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/system-log`);
      if (!resp.ok) return;
      const data = await resp.json();
      const withExp = data.filter(e => e.explanation);

      const reversed = [...withExp].reverse();

      reversed.forEach(e => {
        const key = `${e.timestamp}-${e.explanation?.decision}-${e.explanation?.bus_id}`;
        if (!seenIdsRef.current.has(key)) {
          seenIdsRef.current.add(key);
          if (seenIdsRef.current.size > 5) {
            addNotification({
              type: 'ai_decision',
              title: e.explanation?.decision || e.message,
              message: e.explanation?.reasoning?.slice(0, 120) || e.message,
              busLabel: e.explanation?.bus_id?.replace('bus_0', 'Bus '),
              bus_id: e.explanation?.bus_id,
              confidence: e.explanation?.confidence,
            });
          }
        }
      });

      setEntries(reversed.slice(0, 50));
    } catch { /* */ }
  }, [addNotification]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 2500);
    return () => clearInterval(iv);
  }, [poll]);

  let display = entries;
  if (busFilter) {
    display = entries.filter(e => e.explanation?.bus_id === busFilter);
  }
  if (sortAsc) {
    display = [...display].reverse();
  }

  return (
    <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: '8px', borderBottom: '1px solid rgba(0,242,255,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="font-label-caps" style={{ fontSize: '14px', color: 'var(--signal-cyan)', textShadow: '0 0 8px rgba(0,242,255,0.4)' }}>SYSTEM INTEL</span>
          <span className="font-data-display" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>[{display.length}]</span>
        </div>
        <button onClick={() => setSortAsc(!sortAsc)} className="font-label-caps" style={{
          fontSize: '10px', padding: '4px 8px', borderRadius: '4px',
          border: '1px solid var(--color-border)', cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-secondary)',
          transition: 'all 0.2s',
        }}>
          {sortAsc ? 'CHRONOLOGICAL' : 'REVERSE CHRONO'}
        </button>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
        {display.length === 0 && (
          <p className="font-label-caps" style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0' }}>
            {busFilter ? `AWAITING TELEMETRY...` : 'STANDBY MODE'}
          </p>
        )}
        {display.map((entry, i) => {
          const exp = entry.explanation || {};
          const decision = exp.decision || entry.message || '';
          const bColor = BORDER_COLORS[decision] || 'var(--color-border)';
          const bgColor = BG_DARK[decision] || 'rgba(255,255,255,0.02)';
          const isExpanded = expandedIdx === i;
          const recent = isRecent(entry.timestamp);

          return (
            <div key={i} className="glass-card" style={{
              borderLeft: `2px solid ${bColor}`,
              borderRight: 'none', borderTop: 'none', borderBottom: 'none',
              background: bgColor,
              padding: '10px 12px',
              transition: 'all 0.2s',
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="font-data-display" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{entry.timestamp}</span>
                <span className="font-label-caps" style={{ fontSize: '11px', color: bColor, textShadow: `0 0 8px ${bColor}80` }}>{decision}</span>
                {exp.bus_id && (
                  <span className="font-data-display" style={{
                    fontSize: '11px', padding: '2px 6px', borderRadius: '2px',
                    background: 'rgba(0,0,0,0.4)', color: 'var(--color-text-secondary)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>{exp.bus_id.replace('bus_0', '').replace('bus_', '')}</span>
                )}
                {recent && <span className="font-label-caps" style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '2px', background: 'var(--signal-amber)', color: '#000', boxShadow: '0 0 8px rgba(249,115,22,0.8)', animation: 'signal-blink 1s infinite' }}>NEW</span>}
              </div>

              {/* Trigger */}
              {exp.trigger && (
                <p className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>TRIGGER: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'Inter', textTransform: 'none' }}>{exp.trigger}</span></p>
              )}

              {/* Expand toggle */}
              <button onClick={() => setExpandedIdx(isExpanded ? null : i)} className="font-label-caps glow-cyan" style={{
                fontSize: '10px', color: 'var(--signal-cyan)', marginTop: '8px',
                background: 'rgba(0,242,255,0.1)', border: '1px solid var(--signal-cyan)', cursor: 'pointer', padding: '2px 8px', borderRadius: '4px'
              }}>
                {isExpanded ? 'CLOSE LOG' : 'VIEW LOG'}
              </button>

              {/* Expanded reasoning */}
              {isExpanded && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${bColor}40` }}>
                  {exp.reasoning && (
                    <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 10px', fontFamily: 'Inter' }}>{exp.reasoning}</p>
                  )}
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {exp.confidence != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>CONFIDENCE</span>
                        <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '2px', width: `${Math.round(exp.confidence * 100)}%`,
                            background: exp.confidence >= 0.75 ? 'var(--signal-green)' : exp.confidence >= 0.5 ? 'var(--signal-amber)' : 'var(--signal-red)',
                            boxShadow: `0 0 8px ${exp.confidence >= 0.75 ? 'var(--signal-green)' : exp.confidence >= 0.5 ? 'var(--signal-amber)' : 'var(--signal-red)'}`
                          }} />
                        </div>
                        <span className="font-data-display" style={{
                          fontSize: '14px',
                          color: exp.confidence >= 0.75 ? 'var(--signal-green)' : exp.confidence >= 0.5 ? 'var(--signal-amber)' : 'var(--signal-red)',
                        }}>{Math.round(exp.confidence * 100)}%</span>
                      </div>
                    )}
                    {exp.expected_duration && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="font-label-caps" style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>DURATION</span>
                        <span className="font-data-display" style={{ fontSize: '14px', color: 'var(--color-text)' }}>{exp.expected_duration}</span>
                      </div>
                    )}
                  </div>
                  {exp.action && (
                    <p className="font-label-caps" style={{ fontSize: '10px', color: 'var(--signal-cyan)', margin: '8px 0 0' }}>EXEC: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'Inter', textTransform: 'none' }}>{exp.action}</span></p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
