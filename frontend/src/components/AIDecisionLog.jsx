/**
 * AIDecisionLog.jsx — Professional Clean System Intel
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

const BG_COLORS = {
  'Ghost Bus Activated': 'rgba(245,158,11,0.05)',
  'Buffer Flush Executed': 'rgba(16,185,129,0.05)',
  'Ping Interval Adjusted': 'rgba(99,102,241,0.05)',
  'ETA Recalculated': 'rgba(99,102,241,0.05)',
  'Dead Zone Entry': 'rgba(239,68,68,0.05)',
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
    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: '12px', borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Intel</span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)' }}>[{display.length}]</span>
        </div>
        <button onClick={() => setSortAsc(!sortAsc)} style={{
          fontSize: '11px', fontWeight: 600, padding: '6px 12px', borderRadius: '6px',
          border: '1px solid var(--color-border)', cursor: 'pointer',
          background: 'rgba(255,255,255,0.5)', color: 'var(--color-text-secondary)',
          transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          {sortAsc ? 'CHRONOLOGICAL' : 'REVERSE CHRONO'}
        </button>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
        {display.length === 0 && (
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-muted)', textAlign: 'center', padding: '30px 0' }}>
            {busFilter ? `AWAITING TELEMETRY...` : 'STANDBY MODE'}
          </p>
        )}
        {display.map((entry, i) => {
          const exp = entry.explanation || {};
          const decision = exp.decision || entry.message || '';
          const bColor = BORDER_COLORS[decision] || 'var(--color-border)';
          const bgColor = BG_COLORS[decision] || 'var(--color-bg-card)';
          const isExpanded = expandedIdx === i;
          const recent = isRecent(entry.timestamp);

          return (
            <div key={i} className="glass-card" style={{
              borderLeft: `4px solid ${bColor}`,
              borderRight: '1px solid var(--color-border)',
              borderTop: '1px solid var(--color-border)',
              borderBottom: '1px solid var(--color-border)',
              background: bgColor,
              padding: '16px',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span className="font-data-display" style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>{entry.timestamp}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: bColor === 'var(--color-border)' ? 'var(--color-text)' : bColor }}>{decision}</span>
                {exp.bus_id && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '4px 8px', borderRadius: '6px',
                    background: 'var(--color-border-darker)', color: 'var(--color-text-secondary)',
                  }}>{exp.bus_id.replace('bus_0', '').replace('bus_', '')}</span>
                )}
                {recent && <span style={{ fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '4px', background: 'var(--signal-amber)', color: '#fff' }}>NEW</span>}
              </div>

              {/* Trigger */}
              {exp.trigger && (
                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-text-muted)', margin: '8px 0 0' }}>TRIGGER: <span style={{ color: 'var(--color-text)', fontWeight: 400 }}>{exp.trigger}</span></p>
              )}

              {/* Expand toggle */}
              <button onClick={() => setExpandedIdx(isExpanded ? null : i)} style={{
                fontSize: '11px', fontWeight: 600, color: 'var(--signal-cyan)', marginTop: '12px',
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px',
                transition: 'all 0.2s'
              }}>
                {isExpanded ? 'CLOSE LOG' : 'VIEW DETAILED LOG'}
              </button>

              {/* Expanded reasoning */}
              {isExpanded && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid var(--color-border)` }}>
                  {exp.reasoning && (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 16px' }}>{exp.reasoning}</p>
                  )}
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {exp.confidence != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Confidence</span>
                        <div style={{ width: '100px', height: '6px', background: 'var(--color-border-darker)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '3px', width: `${Math.round(exp.confidence * 100)}%`,
                            background: exp.confidence >= 0.75 ? 'var(--signal-green)' : exp.confidence >= 0.5 ? 'var(--signal-amber)' : 'var(--signal-red)',
                          }} />
                        </div>
                        <span className="font-data-display" style={{
                          fontSize: '14px',
                          color: exp.confidence >= 0.75 ? 'var(--signal-green)' : exp.confidence >= 0.5 ? 'var(--signal-amber)' : 'var(--signal-red)',
                        }}>{Math.round(exp.confidence * 100)}%</span>
                      </div>
                    )}
                    {exp.expected_duration && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Duration</span>
                        <span className="font-data-display" style={{ fontSize: '14px', color: 'var(--color-text)' }}>{exp.expected_duration}</span>
                      </div>
                    )}
                  </div>
                  {exp.action && (
                    <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--signal-cyan)', margin: '16px 0 0' }}>EXEC: <span style={{ color: 'var(--color-text)', fontWeight: 400 }}>{exp.action}</span></p>
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
