/**
 * TransitionOverlay — Full-screen overlay during 2D ↔ 3D transitions.
 *
 * Fades in/out over 450ms. Shows bus label when entering 3D,
 * "Fleet Overview" when exiting. Unmounts automatically after animation.
 */

import React from 'react';

// SVG Bus icon (no emoji)
const BusLogo = () => (
  <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-9.75a3.375 3.375 0 00-3.375-3.375h-9A3.375 3.375 0 005.25 7.875v6.375m13.5 4.5V7.875" />
  </svg>
);

const MapIcon = () => (
  <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 6.75V15m0-6H6.75m2.25 0h2.25M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function TransitionOverlay({ direction, busLabel }) {
  return (
    <div className="transition-overlay">
      <div className="transition-content">
        {direction === 'entering' ? (
          <>
            <BusLogo />
            <div className="transition-title">Switching to 3D View</div>
            <div className="transition-sub">Tracking {busLabel || 'Bus'}</div>
            <div className="transition-bar">
              <div className="transition-bar-fill" />
            </div>
          </>
        ) : (
          <>
            <MapIcon />
            <div className="transition-title">Returning to Fleet Overview</div>
            <div className="transition-bar">
              <div className="transition-bar-fill" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
