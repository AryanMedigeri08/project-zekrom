/**
 * Header.jsx — Zekrom branding, tab switcher, bell, theme toggle, alerts.
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

export default function Header({ buses, isConnected, mode, selectedBus, activeTab, onTabChange }) {
  const { theme, toggleTheme } = useTheme();
  const { unreadCount, toggleNotifications } = useNotifications();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const busEntries = Object.values(buses || {});
  const alertCount = busEntries.filter(b => b.is_ghost || (b.signal_strength ?? 85) < 40 || b.in_dead_zone).length;

  return (
    <header style={{
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-nav-bg)',
      zIndex: 20,
      flexShrink: 0,
    }}>
      {/* Left: Zekrom branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #6366f1, #14b8a6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
          fontSize: '18px', color: '#fff', fontWeight: 800
        }}>Z</div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.2, margin: 0 }}>
            Zekrom
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 500, letterSpacing: '1.5px', margin: 0, lineHeight: 1 }}>
            RESILIENT FLEET MONITOR
          </p>
        </div>
      </div>

      {/* Center: Tab switcher (only in 2D) */}
      {mode === '2d' && (
        <div style={{
          display: 'flex', borderRadius: '8px', overflow: 'hidden',
          border: '1px solid var(--color-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <button onClick={() => onTabChange('live')} style={{
            padding: '6px 18px', fontSize: '13px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '6px',
            border: 'none', borderRight: '1px solid var(--color-border)', cursor: 'pointer',
            background: activeTab === 'live' ? (theme === 'dark' ? '#0d3331' : '#f0fdfa') : 'var(--color-bg-card)',
            color: activeTab === 'live' ? '#14b8a6' : 'var(--color-text-muted)',
          }}>
            <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Live Map
          </button>
          <button onClick={() => onTabChange('simulation')} style={{
            padding: '6px 18px', fontSize: '13px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '6px',
            border: 'none', cursor: 'pointer',
            background: activeTab === 'simulation' ? (theme === 'dark' ? '#1e1338' : '#faf5ff') : 'var(--color-bg-card)',
            color: activeTab === 'simulation' ? '#8b5cf6' : 'var(--color-text-muted)',
          }}>
            <svg style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5" />
            </svg>
            Simulation Lab
          </button>
        </div>
      )}

      {mode === '3d' && selectedBus && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '8px',
          background: theme === 'dark' ? '#1e1b4b' : '#eef2ff',
          border: '1px solid #6366f1',
        }}>
          <svg style={{ width: '14px', height: '14px', color: '#6366f1' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#6366f1' }}>3D: {selectedBus.label}</span>
        </div>
      )}

      {/* Right: alerts + clock + bell + theme */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '4px 12px', borderRadius: '999px',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isConnected ? '#22c55e' : '#ef4444',
            boxShadow: `0 0 6px ${isConnected ? '#22c55e' : '#ef4444'}`,
            animation: 'signal-blink 1.5s infinite',
          }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            {busEntries.length} buses
          </span>
          {alertCount > 0 && (
            <>
              <span style={{ color: 'var(--color-border)' }}>|</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#ef4444' }}>
                {alertCount} alert{alertCount > 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>

        <span style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--color-text-muted)', letterSpacing: '1px' }}>
          {clock}
        </span>

        {/* Notification bell */}
        <button onClick={toggleNotifications} className="notification-bell" style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '14px', fontWeight: 700, padding: '4px', color: 'var(--color-text)'
        }}>
          Alerts
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-2px', right: '-4px',
              fontSize: '10px', fontWeight: 800, color: '#fff',
              background: '#ef4444', borderRadius: '999px',
              padding: '1px 5px', minWidth: '16px', textAlign: 'center',
              lineHeight: '14px',
            }}>{unreadCount}</span>
          )}
        </button>

        {/* Theme toggle */}
        <button onClick={toggleTheme} className="theme-toggle" title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '14px', fontWeight: 700, padding: '4px', transition: 'transform 0.3s ease', color: 'var(--color-text)'
        }}>
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
    </header>
  );
}
