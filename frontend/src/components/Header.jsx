/**
 * Header.jsx — Top bar with system name, fleet status, live clock, alerts.
 */

import React, { useState, useEffect } from 'react';

const BusIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-9.75a3.375 3.375 0 00-3.375-3.375h-9A3.375 3.375 0 005.25 7.875v6.375m13.5 4.5V7.875" />
  </svg>
);

export default function Header({ buses, isConnected, mode, selectedBus, simDrawerOpen, onToggleSimDrawer }) {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const busEntries = Object.values(buses || {});
  const activeCount = busEntries.length;
  const alertCount = busEntries.filter(b => b.is_ghost || (b.signal_strength ?? 85) < 40 || b.in_dead_zone).length;

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-gray-200 bg-white/95 backdrop-blur-sm z-20 flex-shrink-0">
      {/* Left: branding */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center shadow-sm">
          <BusIcon />
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-800 tracking-tight leading-tight">
            TransitIQ <span className="text-indigo-600 font-extrabold">Live Fleet Monitor</span>
          </h1>
          <p className="text-[8px] text-gray-400 font-medium tracking-[0.15em] -mt-0.5">PUNE TRANSIT NETWORK</p>
        </div>
      </div>

      {/* Center: status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 border border-gray-200">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-teal-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-[10px] font-semibold text-gray-600">
            {activeCount} buses active
          </span>
          {alertCount > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="text-[10px] font-bold text-red-500">{alertCount} alert{alertCount > 1 ? 's' : ''}</span>
            </>
          )}
        </div>

        {mode === '3d' && selectedBus && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
            <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
            <span className="text-[10px] font-bold text-indigo-700">3D: {selectedBus.label}</span>
          </div>
        )}
      </div>

      {/* Right: clock + sim toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-gray-400 tracking-wider">{clock}</span>
        <button onClick={onToggleSimDrawer}
          className={`px-3 py-1 rounded-lg text-[10px] font-semibold border transition-all ${
            simDrawerOpen
              ? 'bg-purple-50 border-purple-300 text-purple-700'
              : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700'
          }`}>
          <svg className="w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5" />
          </svg>
          Simulation
        </button>
      </div>
    </header>
  );
}
