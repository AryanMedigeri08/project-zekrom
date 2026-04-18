/**
 * Header.jsx — Mission Control HUD Header with Glassmorphism
 */

import React, { useState, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';

export default function Header({ buses, isConnected, mode, selectedBus, activeTab, onTabChange }) {
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
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(0, 242, 255, 0.2)',
      boxShadow: '0 0 20px rgba(0,0,0,0.5)',
      zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Left: Zekrom branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 className="font-headline-md" style={{ 
          fontSize: '24px', 
          fontWeight: 800, 
          color: 'var(--signal-cyan)', 
          margin: 0, 
          letterSpacing: '-1px',
          textShadow: '0 0 10px rgba(0, 242, 255, 0.5)' 
        }}>
          Zekrom
        </h1>
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
        
        {/* Center: Tab switcher (only in 2D) */}
        {mode === '2d' && (
          <nav style={{ display: 'flex', gap: '32px' }}>
            <button onClick={() => onTabChange('live')} className="font-label-caps" style={{
              fontSize: '14px', 
              color: activeTab === 'live' ? 'var(--signal-cyan)' : 'var(--color-text-muted)',
              borderBottom: activeTab === 'live' ? '2px solid var(--signal-cyan)' : 'transparent',
              paddingBottom: '8px',
              background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer',
              textShadow: activeTab === 'live' ? '0 0 8px rgba(0,242,255,0.5)' : 'none',
              transition: 'all 0.2s',
            }}>
              OVERVIEW
            </button>
            <button onClick={() => onTabChange('simulation')} className="font-label-caps" style={{
              fontSize: '14px', 
              color: activeTab === 'simulation' ? 'var(--signal-cyan)' : 'var(--color-text-muted)',
              borderBottom: activeTab === 'simulation' ? '2px solid var(--signal-cyan)' : 'transparent',
              paddingBottom: '8px',
              background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer',
              textShadow: activeTab === 'simulation' ? '0 0 8px rgba(0,242,255,0.5)' : 'none',
              transition: 'all 0.2s',
            }}>
              LABORATORY
            </button>
          </nav>
        )}
      </div>

      {mode === '3d' && selectedBus && (
        <div className="font-label-caps glow-cyan" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', borderRadius: '4px',
          background: 'rgba(0, 242, 255, 0.1)',
          border: '1px solid var(--signal-cyan)',
          color: 'var(--signal-cyan)'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>flight_takeoff</span>
          <span>TRACKING: {selectedBus.label}</span>
        </div>
      )}

      {/* Right: alerts + clock + bell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className={isConnected ? "signal-dot online" : "signal-dot offline"} />
          <span className="font-label-caps" style={{ fontSize: '10px', color: isConnected ? 'var(--signal-green)' : 'var(--signal-red)' }}>
            System {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="font-data-display" style={{ fontSize: '16px', color: 'var(--signal-cyan)', letterSpacing: '2px' }}>
          {clock}
        </div>

        {/* Notification bell */}
        <button onClick={toggleNotifications} style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-secondary)', transition: 'color 0.2s'
        }}>
          <span className="material-symbols-outlined">notifications</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-4px', right: '-4px',
              fontSize: '10px', fontWeight: 800, color: '#fff',
              background: 'var(--signal-red)', borderRadius: '999px',
              padding: '2px 6px', textAlign: 'center',
              boxShadow: '0 0 10px rgba(239, 68, 68, 0.8)'
            }}>{unreadCount}</span>
          )}
        </button>
      </div>
    </header>
  );
}
