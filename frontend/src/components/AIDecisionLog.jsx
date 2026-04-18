/**
 * AIDecisionLog.jsx — Newest-first, sort toggle, NEW badge, theme-aware.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

const API_BASE = 'http://localhost:8000';

const BORDER_COLORS = {
  'Ghost Bus Activated': '#8b5cf6',
  'Buffer Flush Executed': '#22c55e',
  'Ping Interval Adjusted': '#eab308',
  'ETA Recalculated': '#3b82f6',
  'Dead Zone Entry': '#ef4444',
};

const BG_DARK = {
  'Ghost Bus Activated': 'rgba(139,92,246,0.08)',
  'Buffer Flush Executed': 'rgba(34,197,94,0.08)',
  'Ping Interval Adjusted': 'rgba(234,179,8,0.08)',
  'ETA Recalculated': 'rgba(59,130,246,0.08)',
  'Dead Zone Entry': 'rgba(239,68,68,0.08)',
};

const BG_LIGHT = {
  'Ghost Bus Activated': 'rgba(139,92,246,0.06)',
  'Buffer Flush Executed': 'rgba(34,197,94,0.06)',
  'Ping Interval Adjusted': 'rgba(234,179,8,0.06)',
  'ETA Recalculated': 'rgba(59,130,246,0.06)',
  'Dead Zone Entry': 'rgba(239,68,68,0.06)',
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
  const { theme } = useTheme();
  const { addNotification } = useNotifications();
  const isDark = theme === 'dark';
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

      // Newest first: reverse the API data (API returns oldest first)
      const reversed = [...withExp].reverse();

      // Detect new entries and push notifications
      reversed.forEach(e => {
        const key = `${e.timestamp}-${e.explanation?.decision}-${e.explanation?.bus_id}`;
        if (!seenIdsRef.current.has(key)) {
          seenIdsRef.current.add(key);
          if (seenIdsRef.current.size > 5) { // skip initial batch
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

  // Filter by bus if provided
  let display = entries;
  if (busFilter) {
    display = entries.filter(e => e.explanation?.bus_id === busFilter);
  }

  // Sort toggle: newest first (default) or oldest first
  if (sortAsc) {
    display = [...display].reverse();
  }

  return (
    <div className="zk-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: '6px', borderBottom: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>AI Decisions</span>
          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{display.length}</span>
        </div>
        <button onClick={() => setSortAsc(!sortAsc)} style={{
          fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
          border: '1px solid var(--color-border)', cursor: 'pointer',
          background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
        }}>
          {sortAsc ? '↓ Oldest First' : '↑ Newest First'}
        </button>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {display.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
            {busFilter ? `No decisions for this bus yet. Monitoring...` : 'No AI decisions yet'}
          </p>
        )}
        {display.map((entry, i) => {
          const exp = entry.explanation || {};
          const decision = exp.decision || entry.message || '';
          const borderColor = BORDER_COLORS[decision] || 'var(--color-border)';
          const bgColor = isDark ? (BG_DARK[decision] || 'transparent') : (BG_LIGHT[decision] || 'transparent');
          const isExpanded = expandedIdx === i;
          const recent = isRecent(entry.timestamp);

          return (
            <div key={i} style={{
              borderLeft: `3px solid ${borderColor}`,
              background: bgColor,
              borderRadius: '0 8px 8px 0',
              padding: '8px 12px',
              transition: 'all 0.15s',
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{entry.timestamp}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)' }}>{decision}</span>
                {exp.bus_id && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                    background: isDark ? '#1e293b' : '#e2e8f0', color: 'var(--color-text-secondary)',
                  }}>{exp.bus_id.replace('bus_0', '').replace('bus_', '')}</span>
                )}
                {recent && <span className="new-badge">NEW</span>}
              </div>

              {/* Trigger */}
              {exp.trigger && (
                <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '2px 0 0' }}>Trigger: {exp.trigger}</p>
              )}

              {/* Expand toggle */}
              <button onClick={() => setExpandedIdx(isExpanded ? null : i)} style={{
                fontSize: '12px', fontWeight: 600, color: '#6366f1', marginTop: '4px',
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}>
                {isExpanded ? '▼ Hide Reasoning' : '▶ View Reasoning'}
              </button>

              {/* Expanded reasoning */}
              {isExpanded && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                  {exp.reasoning && (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 6px' }}>{exp.reasoning}</p>
                  )}
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {exp.confidence != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Confidence:</span>
                        <div style={{ width: '60px', height: '6px', background: 'var(--color-border)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '3px', width: `${Math.round(exp.confidence * 100)}%`,
                            background: exp.confidence >= 0.75 ? '#22c55e' : exp.confidence >= 0.5 ? '#eab308' : '#ef4444',
                          }} />
                        </div>
                        <span style={{
                          fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: exp.confidence >= 0.75 ? '#22c55e' : exp.confidence >= 0.5 ? '#eab308' : '#ef4444',
                        }}>{Math.round(exp.confidence * 100)}%</span>
                      </div>
                    )}
                    {exp.expected_duration && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Duration:</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>{exp.expected_duration}</span>
                      </div>
                    )}
                  </div>
                  {exp.action && (
                    <p style={{ fontSize: '12px', color: '#6366f1', fontWeight: 500, margin: '6px 0 0' }}>Action: {exp.action}</p>
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
