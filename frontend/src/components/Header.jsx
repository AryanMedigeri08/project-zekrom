/**
 * Header.jsx — Professional Clean Glassmorphism
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
      background: 'rgba(255, 255, 255, 0.4)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--color-border)',
      boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
      zIndex: 50,
      flexShrink: 0,
    }}>
      {/* Left: Zekrom branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <h1 style={{ 
          fontSize: '22px', 
          fontWeight: 700, 
          color: 'var(--color-text)', 
          margin: 0, 
          letterSpacing: '-0.5px',
        }}>
          Zekrom
        </h1>
        <div style={{ width: '1px', height: '24px', background: 'var(--color-border)' }} />
        
        {/* Center: Tab switcher (only in 2D) */}
        {mode === '2d' && (
          <nav style={{ display: 'flex', gap: '32px' }}>
            <button onClick={() => onTabChange('live')} style={{
              fontSize: '14px', 
              fontWeight: 600,
              color: activeTab === 'live' ? 'var(--signal-cyan)' : 'var(--color-text-muted)',
              borderBottom: activeTab === 'live' ? '2px solid var(--signal-cyan)' : '2px solid transparent',
              paddingBottom: '2px',
              background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              Overview
            </button>
            <button onClick={() => onTabChange('simulation')} style={{
              fontSize: '14px', 
              fontWeight: 600,
              color: activeTab === 'simulation' ? 'var(--signal-cyan)' : 'var(--color-text-muted)',
              borderBottom: activeTab === 'simulation' ? '2px solid var(--signal-cyan)' : '2px solid transparent',
              paddingBottom: '2px',
              background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer',
              transition: 'all 0.2s',
            }}>
              Laboratory
            </button>
          </nav>
        )}
      </div>

      {mode === '3d' && selectedBus && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 12px', borderRadius: '6px',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          color: 'var(--signal-cyan)',
          fontWeight: 600,
          fontSize: '13px'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>flight_takeoff</span>
          <span>Tracking: {selectedBus.label}</span>
        </div>
      )}

      {/* Right: alerts + clock + bell */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className={isConnected ? "signal-dot online" : "signal-dot offline"} />
          <span style={{ fontSize: '12px', fontWeight: 500, color: isConnected ? 'var(--signal-green)' : 'var(--signal-red)' }}>
            System {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>

        <div className="font-data-display" style={{ fontSize: '15px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          {clock}
        </div>

        {/* Notification bell */}
        <button onClick={toggleNotifications} style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-muted)', transition: 'color 0.2s'
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>notifications</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '-2px', right: '-2px',
              fontSize: '10px', fontWeight: 700, color: '#fff',
              background: 'var(--signal-red)', borderRadius: '10px',
              minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px'
            }}>{unreadCount}</span>
          )}
        </button>
      </div>
    </header>
  );
}
