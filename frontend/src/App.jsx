/**
 * App.jsx — Phase 5: Two tabs (Live / Simulation), panels on right side of map.
 *
 * Live Tab:   Square Map (left) + Right column (BusSidebar, ETA, Network, AI Log)
 * Sim Tab:    Full SimulationDashboard with controls, map, scenarios
 * 3D Mode:    MapboxView + sidebar + compact strip (overrides tabs)
 */

import React, { useState } from 'react';
import useWebSocket from './hooks/useWebSocket';
import useSimConfig from './hooks/useSimConfig';
import useMapMode from './hooks/useMapMode';
import Header from './components/Header';
import MapView from './components/MapView';
import MapboxView from './components/MapboxView';
import TransitionOverlay from './components/TransitionOverlay';
import CompactStatusStrip from './components/CompactStatusStrip';
import BusSidebar from './components/BusSidebar';
import NetworkPanel from './components/NetworkPanel';
import ETATimeline from './components/ETATimeline';
import AIDecisionLog from './components/AIDecisionLog';
import SimulationDashboard from './components/SimulationDashboard';

function getTrafficColor(level) {
  if (level === 'low' || level === 0) return '#22c55e';
  if (level === 'high' || level === 2) return '#ef4444';
  return '#eab308';
}

const MapIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
  </svg>
);

const LabIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
  </svg>
);

export default function App() {
  const {
    isConnected, routes, buses, signalHistory,
    bufferedPings, clearBufferedPings,
    deadZones, mitaoe,
  } = useWebSocket();

  const simConfig = useSimConfig();
  const {
    mode, selectedBusId, showOverlay, overlayDirection,
    selectBus, returnToFleet,
  } = useMapMode();

  const [activeTab, setActiveTab] = useState('live');

  const selectedBus = buses[selectedBusId] || null;
  const selectedRoute = selectedBusId && selectedBus
    ? routes[selectedBus.route_id] || null
    : null;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">

      {/* Transition Overlay */}
      {showOverlay && (
        <TransitionOverlay direction={overlayDirection} busLabel={selectedBus?.label} />
      )}

      {/* Header with tab switcher */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-gray-200 bg-white/95 backdrop-blur-sm z-20 flex-shrink-0">
        {/* Left: branding */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-9.75a3.375 3.375 0 00-3.375-3.375h-9A3.375 3.375 0 005.25 7.875v6.375m13.5 4.5V7.875" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-800 tracking-tight leading-tight">
              TransitIQ <span className="text-indigo-600 font-extrabold">Live Fleet Monitor</span>
            </h1>
            <p className="text-[8px] text-gray-400 font-medium tracking-[0.15em] -mt-0.5">PUNE TRANSIT NETWORK</p>
          </div>
        </div>

        {/* Center: Tab switcher (only in 2D) */}
        {mode === '2d' && (
          <div className="flex rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <button onClick={() => setActiveTab('live')}
              className={`px-4 py-1.5 text-[10px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 border-r border-gray-200 ${
                activeTab === 'live' ? 'bg-teal-50 text-teal-700' : 'bg-white text-gray-400 hover:text-gray-600'
              }`}>
              <MapIcon /> Live Map
            </button>
            <button onClick={() => setActiveTab('simulation')}
              className={`px-4 py-1.5 text-[10px] font-semibold tracking-wide transition-colors flex items-center gap-1.5 ${
                activeTab === 'simulation' ? 'bg-purple-50 text-purple-700' : 'bg-white text-gray-400 hover:text-gray-600'
              }`}>
              <LabIcon /> Simulation Lab
            </button>
          </div>
        )}

        {mode === '3d' && selectedBus && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
            <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
            <span className="text-[10px] font-bold text-indigo-700">3D Tracking: {selectedBus.label}</span>
          </div>
        )}

        {/* Right: connection + alerts */}
        <div className="flex items-center gap-3">
          {(() => {
            const busArr = Object.values(buses || {});
            const alertCount = busArr.filter(b => b.is_ghost || (b.signal_strength ?? 85) < 40).length;
            return (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-teal-500' : 'bg-red-500'} animate-pulse`} />
                <span className="text-[9px] font-semibold text-gray-500">
                  {busArr.length} buses
                </span>
                {alertCount > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span className="text-[9px] font-bold text-red-500">{alertCount} alert{alertCount > 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </header>

      {/* ══ 3D MODE ══ */}
      {mode === '3d' ? (
        <>
          <main className="flex-1 flex overflow-hidden">
            <div className="flex-1 relative p-3">
              <MapboxView
                bus={selectedBus}
                routeGeometry={selectedRoute?.geometry}
                routeColor={getTrafficColor(selectedBus?.traffic_level)}
                onBack={returnToFleet}
              />
            </div>
            <div className="w-72 flex-shrink-0 p-3 pl-0 overflow-y-auto">
              <BusSidebar buses={buses} selectedBusId={selectedBusId} onSelectBus={selectBus} mode={mode} />
            </div>
          </main>
          <CompactStatusStrip bus={selectedBus} />
        </>

      ) : activeTab === 'live' ? (
        /* ══ LIVE MAP TAB ══ */
        <main className="flex-1 flex overflow-hidden p-3 gap-3">
          {/* Left: Square Map */}
          <div className="map-wrapper flex-shrink-0">
            <MapView
              routes={routes}
              buses={buses}
              bufferedPings={bufferedPings}
              clearBufferedPings={clearBufferedPings}
              deadZones={deadZones}
              mitaoe={mitaoe}
              onBusSelect={selectBus}
            />
          </div>

          {/* Right: Panels stacked vertically — fills remaining width */}
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-w-[300px]">
            {/* Bus Sidebar (priority sorted) */}
            <div className="flex-shrink-0">
              <BusSidebar buses={buses} selectedBusId={selectedBusId} onSelectBus={selectBus} mode={mode} />
            </div>

            {/* ETA Timeline */}
            <div className="flex-shrink-0">
              <ETATimeline buses={buses} routes={routes} simConfig={simConfig} />
            </div>

            {/* Network + AI Log side by side */}
            <div className="grid grid-cols-2 gap-3 flex-shrink-0" style={{ minHeight: '200px' }}>
              <NetworkPanel buses={buses} signalHistory={signalHistory} />
              <AIDecisionLog />
            </div>
          </div>
        </main>

      ) : (
        /* ══ SIMULATION TAB ══ */
        <main className="flex-1 overflow-y-auto p-3">
          <SimulationDashboard
            simConfig={simConfig}
            routes={routes}
            buses={buses}
            bufferedPings={bufferedPings}
            clearBufferedPings={clearBufferedPings}
          />
        </main>
      )}
    </div>
  );
}
