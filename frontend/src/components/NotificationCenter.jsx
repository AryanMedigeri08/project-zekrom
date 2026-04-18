/**
 * NotificationCenter.jsx — Collapsible notification drawer.
 *
 * Fixed below navbar, slides down with filter tabs, mark-read, clear-all.
 */

import React from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

const TYPE_COLORS = {
  dead_zone_entry: '#7c3aed',
  ghost_activated: '#6366f1',
  signal_weak: '#ef4444',
  signal_restored: '#22c55e',
  buffer_flush: '#14b8a6',
  eta_change: '#3b82f6',
  ai_decision: '#8b5cf6',
  bus_arrived: '#f59e0b',
};

const TYPE_ICONS = {
  dead_zone_entry: '',
  ghost_activated: '',
  signal_weak: '',
  signal_restored: '',
  buffer_flush: '',
  eta_change: '',
  ai_decision: '',
  bus_arrived: '',
};

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'ai_decision', label: 'AI Decisions' },
  { id: 'system', label: 'System Events' },
  { id: 'alerts', label: 'Alerts Only' },
];

function relativeTime(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 10) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function filterNotifications(notifications, filter) {
  if (filter === 'all') return notifications;
  if (filter === 'ai_decision') return notifications.filter(n => n.type === 'ai_decision');
  if (filter === 'system') return notifications.filter(n => n.type !== 'ai_decision');
  if (filter === 'alerts') return notifications.filter(n =>
    ['dead_zone_entry', 'ghost_activated', 'signal_weak'].includes(n.type)
  );
  return notifications;
}

export default function NotificationCenter() {
  const { notifications, isOpen, filter, unreadCount, markRead, markAllRead, clearAll, setFilter } = useNotifications();
  const { theme } = useTheme();

  if (!isOpen) return null;

  const filtered = filterNotifications(notifications, filter);
  const isDark = theme === 'dark';

  return (
    <div className="notif-drawer" style={{
      position: 'fixed',
      top: '56px',
      right: 0,
      width: '380px',
      maxHeight: '60vh',
      overflowY: 'auto',
      zIndex: 1000,
      background: isDark ? 'var(--color-bg-secondary)' : 'var(--color-bg-card)',
      borderLeft: '1px solid var(--color-border)',
      borderBottom: '1px solid var(--color-border)',
      boxShadow: isDark ? '-4px 4px 20px rgba(0,0,0,0.5)' : '-4px 4px 20px rgba(0,0,0,0.1)',
      animation: 'slideDown 250ms ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
          Notifications ({filtered.length})
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={markAllRead} style={{
            fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>Mark all read</button>
          <button onClick={clearAll} style={{
            fontSize: '12px', fontWeight: 600, color: '#ef4444',
            background: 'none', border: 'none', cursor: 'pointer',
          }}>Clear all</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: '4px', padding: '8px 16px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {FILTER_TABS.map(tab => (
          <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
            fontSize: '12px', fontWeight: 600, padding: '4px 10px',
            borderRadius: '6px', border: '1px solid',
            borderColor: filter === tab.id ? '#6366f1' : 'var(--color-border)',
            background: filter === tab.id ? (isDark ? '#1e1b4b' : '#eef2ff') : 'transparent',
            color: filter === tab.id ? '#6366f1' : 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div style={{ padding: '4px 0' }}>
        {filtered.length === 0 && (
          <p style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-muted)' }}>
            No notifications
          </p>
        )}
        {filtered.map(n => {
          const borderColor = TYPE_COLORS[n.type] || '#6366f1';
          const icon = TYPE_ICONS[n.type] || '';
          return (
            <div key={n.id} onClick={() => markRead(n.id)} style={{
              padding: '10px 16px',
              borderLeft: `3px solid ${borderColor}`,
              borderBottom: '1px solid var(--color-border)',
              background: n.read
                ? 'transparent'
                : (isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.04)'),
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px' }}>{icon}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>
                  {n.title}
                </span>
                {n.busLabel && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '1px 6px',
                    borderRadius: '4px', background: isDark ? '#1e293b' : '#e2e8f0',
                    color: 'var(--color-text-secondary)',
                  }}>{n.busLabel}</span>
                )}
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                  {relativeTime(n.timestamp)}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {n.message}
              </p>
              {n.type === 'ai_decision' && n.confidence != null && (
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#8b5cf6', fontWeight: 600 }}>
                  Confidence: {Math.round(n.confidence * 100)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
