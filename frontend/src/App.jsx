/**
 * App — Root layout (Phase 3: multi-bus, light mode).
 *
 * Live Map tab:   ETA strip + expanded map + sidebar (network, fleet, status)
 * Simulation tab: Bus selector + scenario pills + ETA/Map + controls
 */

import React, { useState, useEffect, useCallback } from 'react';
import useWebSocket from './hooks/useWebSocket';
import useSimConfig from './hooks/useSimConfig';
import MapView from './components/MapView';
import NetworkPanel from './components/NetworkPanel';
import StatusBar from './components/StatusBar';
import BusSidebar from './components/BusSidebar';
import SimulationDashboard from './components/SimulationDashboard';
import ETATimeline from './components/ETATimeline';

const API_BASE = 'http://localhost:8000';

const MapPinIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

export default function App() {
  const {
    isConnected, routes, buses, signalHistory,
    bufferedPings, clearBufferedPings,
  } = useWebSocket();

  const simConfig = useSimConfig();
  const [activeTab, setActiveTab] = useState('map');
  const [etaData, setEtaData] = useState(null);

  // Fetch ETA for App-level usage
  const fetchEta = useCallback(async () => {
    try {
      const busId = simConfig.targetBusId || Object.keys(buses)[0] || 'bus_01';
      const tripResp = await fetch(`${API_BASE}/api/trip-status?bus_id=${busId}`);
      if (!tripResp.ok) return;
      const tripMap = await tripResp.json();
      const trip = tripMap[busId];
      if (!trip) return;

      const cfg = simConfig.config;
      const etaResp = await fetch(`${API_BASE}/api/predict-eta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departure_time: new Date().getHours(),
          day_of_week: (new Date().getDay() + 6) % 7,
          traffic_level: cfg.traffic_level ?? 1,
          avg_signal_strength: cfg.signal_strength ?? 85,
          weather: cfg.weather ?? 0,
          num_passengers_approx: 35,
          elapsed_minutes: trip.elapsed_minutes || 0,
          current_stop_index: trip.current_stop_index || 0,
          bus_id: busId,
        }),
      });
      if (etaResp.ok) {
        const data = await etaResp.json();
        data.buffer_count = trip.buffer_count;
        setEtaData(data);
      }
    } catch { /* */ }
  }, [simConfig.config, simConfig.targetBusId, buses]);

  useEffect(() => {
    if (Object.keys(buses).length === 0) return;
    fetchEta();
    const iv = setInterval(fetchEta, 10000);
    return () => clearInterval(iv);
  }, [fetchEta, buses]);

  const busCount = Object.keys(buses).length;
  const ghostCount = Object.values(buses).filter((b) => b.is_ghost).length;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-100">

      {/* ─── Header ─── */}
      <header className="flex items-center justify-between px-5 py-2 border-b border-gray-200 bg-white/90 backdrop-blur-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-blue-500 flex items-center justify-center shadow-sm">
            <MapPinIcon />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-800 tracking-tight">
              Zekrom <span className="text-teal-600 font-extrabold">Transport Tracker</span>
            </h1>
            <p className="text-[9px] text-gray-400 font-medium tracking-wider -mt-0.5">
              {busCount} BUSES &middot; {Object.keys(routes).length} ROUTES &middot; PUNE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <button onClick={() => setActiveTab('map')}
              className={`px-3.5 py-1.5 text-[10px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 border-r border-gray-200 ${
                activeTab === 'map' ? 'bg-teal-50 text-teal-700' : 'bg-white text-gray-400 hover:text-gray-600'
              }`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-6H6.75m2.25 0h2.25m-2.25 0V15" />
              </svg>
              Live Map
            </button>
            <button onClick={() => setActiveTab('simulation')}
              className={`px-3.5 py-1.5 text-[10px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 ${
                activeTab === 'simulation' ? 'bg-purple-50 text-purple-700' : 'bg-white text-gray-400 hover:text-gray-600'
              }`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5" />
              </svg>
              Simulation
            </button>
          </div>

          {/* Fleet status badge */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-teal-500' : 'bg-red-500'}`} />
            <span className="text-[9px] font-semibold text-gray-400 tracking-widest">
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
            {ghostCount > 0 && (
              <span className="text-[9px] font-bold text-red-500 ml-1">{ghostCount} ghost</span>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto p-3 gap-3">
        {activeTab === 'map' ? (
          /* ═══ LIVE MAP TAB ═══ */
          <div className="flex gap-3 h-full">
            {/* Left: ETA strip + expanded Map */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div className="flex-shrink-0">
                <ETATimeline signalStrength={simConfig.config.signal_strength} simConfig={simConfig} routes={routes} buses={buses} />
              </div>
              <div className="flex-1 min-h-0">
                <MapView routes={routes} buses={buses} bufferedPings={bufferedPings} clearBufferedPings={clearBufferedPings} />
              </div>
            </div>

            {/* Right sidebar */}
            <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
              <div style={{ minHeight: '220px' }}>
                <NetworkPanel buses={buses} signalHistory={signalHistory} />
              </div>
              <BusSidebar buses={buses} />
              <StatusBar buses={buses} isConnected={isConnected} />
            </div>
          </div>
        ) : (
          /* ═══ SIMULATION TAB ═══ */
          <SimulationDashboard
            simConfig={simConfig}
            etaData={etaData}
            routes={routes}
            buses={buses}
            signalStrength={simConfig.config.signal_strength}
            bufferedPings={bufferedPings}
            clearBufferedPings={clearBufferedPings}
          />
        )}
      </main>
    </div>
  );
}
