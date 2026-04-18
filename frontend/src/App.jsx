/**
 * App — Root layout (Phase 4: Hybrid 2D/3D).
 *
 * 2D mode: Leaflet fleet overview + sidebar + network + simulation tabs
 * 3D mode: Mapbox GL focused tracking + compact status strip
 * Transition overlay between modes
 */

import React, { useState, useEffect, useCallback } from 'react';
import useWebSocket from './hooks/useWebSocket';
import useSimConfig from './hooks/useSimConfig';
import useMapMode from './hooks/useMapMode';
import MapView from './components/MapView';
import MapboxView from './components/MapboxView';
import TransitionOverlay from './components/TransitionOverlay';
import CompactStatusStrip from './components/CompactStatusStrip';
import NetworkPanel from './components/NetworkPanel';
import StatusBar from './components/StatusBar';
import BusSidebar from './components/BusSidebar';
import SimulationDashboard from './components/SimulationDashboard';
import ETATimeline from './components/ETATimeline';

const API_BASE = 'http://localhost:8000';

// Traffic color helper
function getTrafficColor(level) {
  if (level === 'low' || level === 0) return '#22c55e';
  if (level === 'high' || level === 2) return '#ef4444';
  return '#eab308';
}

// SVG Icons
const MapPinIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const CubeIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
  </svg>
);

export default function App() {
  const {
    isConnected, routes, buses, signalHistory,
    bufferedPings, clearBufferedPings,
  } = useWebSocket();

  const simConfig = useSimConfig();
  const {
    mode, selectedBusId, showOverlay, overlayDirection,
    selectBus, returnToFleet,
  } = useMapMode();

  const [activeTab, setActiveTab] = useState('map');
  const [etaData, setEtaData] = useState(null);

  // Selected bus and route for 3D view
  const selectedBus = buses[selectedBusId] || null;
  const selectedRoute = selectedBusId && selectedBus
    ? routes[selectedBus.route_id] || null
    : null;

  // Fetch ETA
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

      {/* ── Transition Overlay ── */}
      {showOverlay && (
        <TransitionOverlay direction={overlayDirection} busLabel={selectedBus?.label} />
      )}

      {/* ── Header ── */}
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
          {/* Mode indicator (2D vs 3D) */}
          {mode === '3d' && selectedBus && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
              <CubeIcon />
              <span className="text-[10px] font-bold text-indigo-700">3D Tracking: {selectedBus.label}</span>
            </div>
          )}

          {/* Tab switcher (only in 2D mode) */}
          {mode === '2d' && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <button onClick={() => setActiveTab('map')}
                className={`px-3.5 py-1.5 text-[10px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 border-r border-gray-200 ${
                  activeTab === 'map' ? 'bg-teal-50 text-teal-700' : 'bg-white text-gray-400 hover:text-gray-600'
                }`}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-6H6.75m2.25 0h2.25" />
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
          )}

          {/* Connection badge */}
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

      {/* ── Main Content ── */}
      {mode === '3d' ? (
        /* ════ 3D MODE ════ */
        <>
          <main className="flex-1 flex overflow-hidden">
            {/* 3D Map — full width */}
            <div className="flex-1 relative p-3">
              <MapboxView
                bus={selectedBus}
                routeGeometry={selectedRoute?.geometry}
                routeColor={getTrafficColor(selectedBus?.traffic_level)}
                onBack={returnToFleet}
              />
            </div>

            {/* Right sidebar — only the selected bus card */}
            <div className="w-72 flex-shrink-0 p-3 pl-0 overflow-y-auto">
              <BusSidebar
                buses={buses}
                selectedBusId={selectedBusId}
                onSelectBus={selectBus}
                mode={mode}
              />
            </div>
          </main>

          {/* Compact status strip */}
          <CompactStatusStrip bus={selectedBus} />
        </>

      ) : (
        /* ════ 2D MODE ════ */
        <main className="flex-1 overflow-y-auto p-3">
          {activeTab === 'map' ? (
            /* ── Live Map Tab ── */
            <div className="flex gap-3 h-full">
              <div className="flex-1 flex flex-col gap-3 min-w-0">
                <div className="flex-shrink-0">
                  <ETATimeline signalStrength={simConfig.config.signal_strength} simConfig={simConfig} routes={routes} buses={buses} />
                </div>
                <div className="flex-1 min-h-0">
                  <MapView routes={routes} buses={buses} bufferedPings={bufferedPings}
                    clearBufferedPings={clearBufferedPings} onBusSelect={selectBus} />
                </div>
              </div>
              <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
                <div style={{ minHeight: '220px' }}>
                  <NetworkPanel buses={buses} signalHistory={signalHistory} />
                </div>
                <BusSidebar buses={buses} selectedBusId={selectedBusId} onSelectBus={selectBus} mode={mode} />
                <StatusBar buses={buses} isConnected={isConnected} />
              </div>
            </div>
          ) : (
            /* ── Simulation Tab ── */
            <SimulationDashboard
              simConfig={simConfig} etaData={etaData} routes={routes} buses={buses}
              signalStrength={simConfig.config.signal_strength}
              bufferedPings={bufferedPings} clearBufferedPings={clearBufferedPings}
            />
          )}
        </main>
      )}
    </div>
  );
}
