/**
 * TransitionOverlay — Full-screen overlay during 2D ↔ 3D transitions.
 */

import React, { useEffect, useState } from 'react';

const BusLogo = () => (
  <svg style={{ width: '40px', height: '40px', color: 'var(--signal-cyan)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-9.75a3.375 3.375 0 00-3.375-3.375h-9A3.375 3.375 0 005.25 7.875v6.375m13.5 4.5V7.875" />
  </svg>
);

const MapIcon = () => (
  <svg style={{ width: '40px', height: '40px', color: 'var(--signal-green)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 6.75V15m0-6H6.75m2.25 0h2.25M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function TransitionOverlay({ direction, busLabel }) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // Fade in
    setOpacity(1);
    // Let parent unmount us after 450ms
    return () => setOpacity(0);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, transition: 'opacity 0.2s', opacity,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
        animation: 'slideUp 0.3s ease-out forwards', transform: 'translateY(10px)'
      }}>
        {direction === 'entering' ? (
          <>
            <BusLogo />
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)' }}>Switching to 3D View</div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Tracking {busLabel || 'Bus'}</div>
            <div style={{ width: '200px', height: '4px', background: 'var(--color-border-darker)', borderRadius: '2px', overflow: 'hidden', marginTop: '8px' }}>
              <div style={{ height: '100%', width: '50%', background: 'var(--signal-cyan)', animation: 'progressSlide 0.4s ease-in-out forwards' }} />
            </div>
          </>
        ) : (
          <>
            <MapIcon />
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text)' }}>Returning to Fleet Overview</div>
            <div style={{ width: '200px', height: '4px', background: 'var(--color-border-darker)', borderRadius: '2px', overflow: 'hidden', marginTop: '8px' }}>
              <div style={{ height: '100%', width: '50%', background: 'var(--signal-green)', animation: 'progressSlide 0.4s ease-in-out forwards' }} />
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes progressSlide { from { width: 0%; } to { width: 100%; } }
      `}</style>
    </div>
  );
}
