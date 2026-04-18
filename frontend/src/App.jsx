/**
 * App.jsx — Phase 6: Zekrom branding, dual tabs, 70:30 layout, NetworkStrip, notifications.
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
  const {
    isConnected, routes, buses, signalHistory,
    bufferedPings, clearBufferedPings,
    deadZones, mitaoe,
  } = useWebSocket(addNotification);

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
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'var(--color-bg)', color: 'var(--color-text)',
    }}>
      {/* Transition Overlay */}
      {showOverlay && <TransitionOverlay direction={overlayDirection} busLabel={selectedBus?.label} />}

      {/* Header */}
      <Header
        buses={buses}
        isConnected={isConnected}
        mode={mode}
        selectedBus={selectedBus}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Network Health Strip (always visible) */}
      <NetworkStrip buses={buses} signalHistory={signalHistory} />

      {/* Notification Center Drawer */}
      <NotificationCenter />

      {/* ══ 3D MODE ══ */}
      {mode === '3d' ? (
        <>
          <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', padding: '12px' }}>
              <MapboxView
                bus={selectedBus}
                routeGeometry={selectedRoute?.geometry}
                routeColor={getTrafficColor(selectedBus?.traffic_level)}
                onBack={returnToFleet}
              />
            </div>
            <div style={{ width: '300px', flexShrink: 0, padding: '12px 12px 12px 0', overflowY: 'auto' }}>
              <BusSidebar buses={buses} selectedBusId={selectedBusId} onSelectBus={selectBus} mode={mode} />
            </div>
          </main>
          <CompactStatusStrip bus={selectedBus} />
        </>

      ) : activeTab === 'live' ? (
        /* ══ LIVE MAP TAB — 70:30 split ══ */
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Map (70%) + Sidebar (30%) */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '70fr 30fr', gap: '12px', padding: '12px', minHeight: 0, overflow: 'hidden' }}>
            {/* Full-height Map */}
            <div style={{ overflow: 'hidden', borderRadius: '12px', minHeight: 0 }}>
              <MapView
                routes={routes}
                buses={buses}
                deadZones={deadZones}
                mitaoe={mitaoe}
                onBusSelect={selectBus}
                mapId="live-map"
              />
            </div>

            {/* Right sidebar: Bus cards, ETA, AI — stacked */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', minHeight: 0 }}>
              <div style={{ flexShrink: 0 }}>
                <BusSidebar buses={buses} selectedBusId={selectedBusId} onSelectBus={selectBus} mode={mode} />
              </div>
              <div style={{ flexShrink: 0 }}>
                <ETATimeline buses={buses} routes={routes} simConfig={simConfig} />
              </div>
              <div style={{ flexShrink: 0, minHeight: '200px' }}>
                <AIDecisionLog />
              </div>
            </div>
          </div>
        </main>

      ) : (
        /* ══ SIMULATION TAB ══ */
        <main style={{ flex: 1, overflow: 'hidden', padding: '12px' }}>
          <SimulationDashboard
            simConfig={simConfig}
            routes={routes}
            buses={buses}
            deadZones={deadZones}
            mitaoe={mitaoe}
          />
        </main>
      )}
    </div>
  );
}
