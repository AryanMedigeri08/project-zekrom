/**
 * App — Root layout for the Resilient Transport Tracker.
 *
 * Phase 2 Layout (tabbed):
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Header                                              │
 *   ├──────────────────────────────────────────────────────┤
 *   │  ETA Timeline (confidence cone)                      │
 *   ├──────────────────────────────┬───────────────────────┤
 *   │                              │  Network Panel        │
 *   │         Map View             │───────────────────────│
 *   │                              │  Status Bar / Control │
 *   └──────────────────────────────┴───────────────────────┘
 *   ┌──────────────────────────────────────────────────────┐
 *   │  Simulation Dashboard (expandable / tab)             │
 *   └──────────────────────────────────────────────────────┘
 */

import React, { useState, useEffect, useCallback } from 'react';
import useWebSocket from './hooks/useWebSocket';
import useSimConfig from './hooks/useSimConfig';
import MapView from './components/MapView';
import NetworkPanel from './components/NetworkPanel';
import StatusBar from './components/StatusBar';
import SimulationDashboard from './components/SimulationDashboard';
import ETATimeline from './components/ETATimeline';

const API_BASE = 'http://localhost:8000';

export default function App() {
  const {
    isConnected,
    route,
    busPosition,
    signalStrength,
    bufferSize,
    bufferedPings,
    clearBufferedPings,
    lastPingTime,
    signalHistory,
  } = useWebSocket();

  const simConfig = useSimConfig();
  const [activeTab, setActiveTab] = useState('map'); // "map" | "simulation"
  const [etaData, setEtaData] = useState(null);

  // Poll ETA data for the timeline and dashboard cards
  const fetchEta = useCallback(async () => {
    try {
      // Get trip status first
      const tripResp = await fetch(`${API_BASE}/api/trip-status`);
      if (!tripResp.ok) return;
      const trip = await tripResp.json();

      const cfg = simConfig.config;
      const etaResp = await fetch(`${API_BASE}/api/predict-eta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure_time: new Date().getHours(),
          day_of_week: (new Date().getDay() + 6) % 7,
          traffic_level: cfg.traffic_level ?? 1,
          avg_signal_strength: cfg.signal_strength ?? signalStrength ?? 85,
          weather: cfg.weather ?? 0,
          num_passengers_approx: 35,
          elapsed_minutes: trip.elapsed_minutes || 0,
          current_stop_index: trip.current_stop_index || 0,
        }),
      });
      if (etaResp.ok) {
        const data = await etaResp.json();
        data.buffer_count = trip.buffer_count;
        setEtaData(data);
      }
    } catch { /* ignore */ }
  }, [simConfig.config, signalStrength]);

  useEffect(() => {
    fetchEta();
    const interval = setInterval(fetchEta, 10000);
    return () => clearInterval(interval);
  }, [fetchEta]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-950">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between px-6 py-2.5 border-b border-surface-700/50 bg-surface-900/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-blue flex items-center justify-center shadow-lg">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-100 tracking-tight">
              Zekrom
              <span className="text-accent-cyan ml-1.5 font-extrabold">Transport Tracker</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-medium tracking-wider -mt-0.5">
              RESILIENT PUBLIC TRANSPORT · PHASE 2
            </p>
          </div>
        </div>

        {/* Tab Switcher + Connection Badge */}
        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex rounded-lg border border-surface-600/40 overflow-hidden">
            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
                activeTab === 'map'
                  ? 'bg-accent-cyan/15 text-accent-cyan'
                  : 'bg-surface-800/40 text-gray-500 hover:text-gray-300'
              }`}
            >
              🗺️ Live Map
            </button>
            <button
              onClick={() => setActiveTab('simulation')}
              className={`px-4 py-1.5 text-[11px] font-semibold tracking-wide transition-colors border-l border-surface-600/40 ${
                activeTab === 'simulation'
                  ? 'bg-accent-purple/15 text-accent-purple'
                  : 'bg-surface-800/40 text-gray-500 hover:text-gray-300'
              }`}
            >
              🧪 Simulation
            </button>
          </div>

          {/* Connection Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800/60 border border-surface-600/40">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? 'bg-accent-cyan shadow-[0_0_6px_rgba(6,214,160,0.6)]'
                  : 'bg-accent-red shadow-[0_0_6px_rgba(239,71,111,0.6)]'
              }`}
            />
            <span className="text-[10px] font-semibold text-gray-400 tracking-widest">
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <span className="text-[10px] text-gray-600 font-mono">MIT AOE · Alandi Route</span>
        </div>
      </header>

      {/* ─── ETA Timeline (always visible) ─── */}
      <div className="px-3 pt-3">
        <ETATimeline
          signalStrength={simConfig.config.signal_strength}
          simConfig={simConfig}
          route={route}
        />
      </div>

      {/* ─── Main Content — Tab-based ─── */}
      <main className="flex-1 flex overflow-hidden p-3 gap-3 min-h-0">
        {activeTab === 'map' ? (
          <>
            {/* Left: Map */}
            <div className="flex-1 min-w-0">
              <MapView
                route={route}
                busPosition={busPosition}
                signalStrength={signalStrength}
                bufferedPings={bufferedPings}
                clearBufferedPings={clearBufferedPings}
              />
            </div>

            {/* Right: Sidebar panels */}
            <div className="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
              <div className="flex-shrink-0" style={{ minHeight: '260px' }}>
                <NetworkPanel
                  signalHistory={signalHistory}
                  signalStrength={signalStrength}
                />
              </div>
              <div className="flex-1">
                <StatusBar
                  signalStrength={signalStrength}
                  bufferSize={bufferSize}
                  lastPingTime={lastPingTime}
                  busPosition={busPosition}
                  isConnected={isConnected}
                />
              </div>
            </div>
          </>
        ) : (
          /* Simulation Dashboard — full width */
          <div className="flex-1 min-w-0">
            <SimulationDashboard
              simConfig={simConfig}
              etaData={etaData}
            />
          </div>
        )}
      </main>
    </div>
  );
}
