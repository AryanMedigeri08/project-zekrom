/**
 * App — Root layout (light mode).
 *
 * Live Map tab:   ETA compact strip + expanded map + small sidebar
 * Simulation tab: ETA + Map (top row) + controls/metrics (bottom)
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

// SVG Icons
const MapPinIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);
const MapIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0 0l-3-3m3 3l3-3m-3-3V6a.75.75 0 01.75-.75h4.5A.75.75 0 0118 6v9m-6 0H6.75A.75.75 0 016 14.25v-4.5A.75.75 0 016.75 9H12" />
  </svg>
);

export default function App() {
  const {
    isConnected, route, busPosition, signalStrength, bufferSize,
    bufferedPings, clearBufferedPings, lastPingTime, signalHistory,
  } = useWebSocket();

  const simConfig = useSimConfig();
  const [activeTab, setActiveTab] = useState('map');
  const [etaData, setEtaData] = useState(null);

  const fetchEta = useCallback(async () => {
    try {
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
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-100">

      {/* ─── Header ─── */}
      <header className="flex items-center justify-between px-5 py-2 border-b border-gray-200 bg-white/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center shadow-sm">
            <MapPinIcon />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-800 tracking-tight">
              Zekrom <span className="text-teal-600 font-extrabold">Transport Tracker</span>
            </h1>
            <p className="text-[9px] text-gray-400 font-medium tracking-wider -mt-0.5">
              RESILIENT PUBLIC TRANSPORT SYSTEM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <button onClick={() => setActiveTab('map')}
              className={`px-3.5 py-1.5 text-[10px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 ${
                activeTab === 'map'
                  ? 'bg-teal-50 text-teal-700 border-r border-gray-200'
                  : 'bg-white text-gray-400 hover:text-gray-600 border-r border-gray-200'
              }`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-6H6.75m2.25 0h2.25m-2.25 0V15m0 0H6.75m2.25 0h2.25M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Live Map
            </button>
            <button onClick={() => setActiveTab('simulation')}
              className={`px-3.5 py-1.5 text-[10px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 ${
                activeTab === 'simulation'
                  ? 'bg-purple-50 text-purple-700'
                  : 'bg-white text-gray-400 hover:text-gray-600'
              }`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
              </svg>
              Simulation
            </button>
          </div>

          {/* Connection badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-teal-500' : 'bg-red-500'}`} />
            <span className="text-[9px] font-semibold text-gray-400 tracking-widest">
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <span className="text-[9px] text-gray-400 font-mono hidden lg:inline">MIT AOE Route</span>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto p-3 gap-3">
        {activeTab === 'map' ? (
          /* ═══ LIVE MAP TAB ═══ */
          <div className="flex gap-3 h-full">
            {/* Left column: ETA strip + Map */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {/* ETA — compact horizontal strip */}
              <div className="flex-shrink-0">
                <ETATimeline signalStrength={simConfig.config.signal_strength} simConfig={simConfig} route={route} />
              </div>
              {/* Map — expands to fill */}
              <div className="flex-1 min-h-0">
                <MapView route={route} busPosition={busPosition} signalStrength={signalStrength}
                  bufferedPings={bufferedPings} clearBufferedPings={clearBufferedPings} />
              </div>
            </div>
            {/* Right sidebar */}
            <div className="w-72 flex-shrink-0 flex flex-col gap-3">
              <div className="flex-shrink-0" style={{ minHeight: '240px' }}>
                <NetworkPanel signalHistory={signalHistory} signalStrength={signalStrength} />
              </div>
              <div className="flex-1 overflow-y-auto">
                <StatusBar signalStrength={signalStrength} bufferSize={bufferSize}
                  lastPingTime={lastPingTime} busPosition={busPosition} isConnected={isConnected} />
              </div>
            </div>
          </div>
        ) : (
          /* ═══ SIMULATION TAB ═══ */
          <SimulationDashboard
            simConfig={simConfig}
            etaData={etaData}
            route={route}
            busPosition={busPosition}
            signalStrength={signalStrength}
            bufferedPings={bufferedPings}
            clearBufferedPings={clearBufferedPings}
          />
        )}
      </main>
    </div>
  );
}
