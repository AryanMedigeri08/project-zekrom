/**
 * App.jsx — Phase 9: Dual-mode Zekrom with independent Live + Lab WebSocket streams.
 *
 * - Live Map tab uses /ws/live (autonomous simulation)
 * - Simulation Lab uses /ws/lab (slider-controlled)
 * - They share NO state — completely independent simulations
 */

import React, { useState } from 'react';
import useWebSocket from './hooks/useWebSocket';
import useSimConfig from './hooks/useSimConfig';
import useMapMode from './hooks/useMapMode';
import { useTheme } from './context/ThemeContext';
import { useNotifications } from './context/NotificationContext';
import Header from './components/Header';
import NetworkStrip from './components/NetworkStrip';
import NotificationCenter from './components/NotificationCenter';
import MapView from './components/MapView';
import MapboxView from './components/MapboxView';
import TransitionOverlay from './components/TransitionOverlay';
import CompactStatusStrip from './components/CompactStatusStrip';
import BusSidebar from './components/BusSidebar';
import ETATimeline from './components/ETATimeline';
import AIDecisionLog from './components/AIDecisionLog';
import SimulationDashboard from './components/SimulationDashboard';

function getTrafficColor(level) {
  if (level === 'low' || level === 0) return '#22c55e';
  if (level === 'high' || level === 2) return '#ef4444';
  return '#eab308';
}

export default function App() {
  const { addNotification } = useNotifications();

  // ── LIVE WebSocket — autonomous simulation, no slider control ──
  const {
    isConnected: liveConnected,
    routes: liveRoutes,
    buses: liveBuses,
    signalHistory: liveSignalHistory,
    bufferedPings: liveBufferedPings,
    clearBufferedPings: liveClearBufferedPings,
    deadZones: liveDeadZones,
    mitaoe: liveMitaoe,
  } = useWebSocket('live', addNotification);

  // ── LAB WebSocket — slider controlled simulation ──
  const {
    isConnected: labConnected,
    routes: labRoutes,
    buses: labBuses,
    signalHistory: labSignalHistory,
    bufferedPings: labBufferedPings,
    clearBufferedPings: labClearBufferedPings,
    deadZones: labDeadZones,
    mitaoe: labMitaoe,
  } = useWebSocket('lab');

  const simConfig = useSimConfig();
  const {
    mode, selectedBusId, showOverlay, overlayDirection,
    selectBus, returnToFleet,
  } = useMapMode();

  const [activeTab, setActiveTab] = useState('live');

  // Live map state
  const selectedBus = liveBuses[selectedBusId] || null;
  const selectedRoute = selectedBusId && selectedBus
    ? liveRoutes[selectedBus.route_id] || null
    : null;

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--color-bg)', color: 'var(--color-text)',
      position: 'relative',
    }}>
      {/* Decorative ambient backdrop for Glassmorphic effect */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0) 70%)',
        filter: 'blur(60px)', zIndex: 0, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0) 70%)',
        filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none',
      }} />
      
      {/* Wrapper to overlay content above background */}
      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Transition Overlay */}
      {showOverlay && <TransitionOverlay direction={overlayDirection} busLabel={selectedBus?.label} />}

      {/* Header */}
      <Header
        buses={liveBuses}
        isConnected={liveConnected}
        mode={mode}
        selectedBus={selectedBus}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Network Health Strip (always visible — shows LIVE data) */}
      <NetworkStrip buses={liveBuses} signalHistory={liveSignalHistory} />

      {/* Notification Center Drawer */}
      <NotificationCenter />

      {/* ══ 3D MODE ══ */}
      {mode === '3d' ? (
        <>
          <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', padding: '16px' }}>
              <MapboxView
                bus={selectedBus}
                routeGeometry={selectedRoute?.geometry}
                routeColor={getTrafficColor(selectedBus?.traffic_level)}
                onBack={returnToFleet}
              />
            </div>
            <div style={{ width: '320px', flexShrink: 0, padding: '16px 16px 16px 0', overflowY: 'auto' }}>
              <BusSidebar buses={liveBuses} selectedBusId={selectedBusId} onSelectBus={selectBus} mode={mode} />
            </div>
          </main>
          <CompactStatusStrip bus={selectedBus} />
        </>

      ) : activeTab === 'live' ? (
        /* ══ LIVE MAP TAB — 70:30 split — uses LIVE WebSocket ══ */
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
          {/* Map (70%) + Sidebar (30%) */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '16px', minHeight: 0, overflow: 'hidden' }}>
            {/* Full-height Map */}
            <div className="glass-card" style={{ overflow: 'hidden', minHeight: 0, padding: '4px' }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '6px', overflow: 'hidden' }}>
                <MapView
                  routes={liveRoutes}
                  buses={liveBuses}
                  deadZones={liveDeadZones}
                  mitaoe={liveMitaoe}
                  onBusSelect={selectBus}
                  mapId="live-map"
                />
              </div>
            </div>

            {/* Right sidebar: Bus cards, ETA, AI — stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', minHeight: 0, paddingRight: '4px' }}>
              <div style={{ flexShrink: 0 }}>
                <BusSidebar buses={liveBuses} selectedBusId={selectedBusId} onSelectBus={selectBus} mode={mode} />
              </div>
              <div className="glass-card" style={{ flexShrink: 0, padding: '16px' }}>
                <ETATimeline buses={liveBuses} routes={liveRoutes} simConfig={simConfig} />
              </div>
              <div style={{ flexShrink: 0, minHeight: '200px' }}>
                <AIDecisionLog />
              </div>
            </div>
          </div>
        </main>

      ) : (
        /* ══ SIMULATION TAB — uses LAB WebSocket ══ */
        <main style={{ flex: 1, overflow: 'hidden', padding: '12px' }}>
          <SimulationDashboard
            simConfig={simConfig}
            routes={labRoutes}
            buses={labBuses}
            deadZones={labDeadZones}
            mitaoe={labMitaoe}
          />
        </main>
      )}
      </div>
    </div>
  );
}
