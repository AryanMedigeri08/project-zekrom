# ⚡ Zekrom — Resilient Fleet Monitor

> Real-time college bus tracking that works reliably under low bandwidth, high latency, and complete signal loss — with full transparency into every internal decision.

---

## 📁 Project Structure

```
project-zekrom/
├── backend/
│   ├── main.py                         # Zekrom API (FastAPI + WebSocket + Layer Status)
│   ├── config.py                       # 5 routes, 5 buses, MITAOE destination
│   ├── gps_emitter.py                  # Multi-bus GPS simulation + 6-layer telemetry
│   ├── dead_zones.py                   # Dead zone definitions + helpers
│   ├── explainer.py                    # AI Decision Explainability engine
│   ├── buffer.py                       # Store-and-forward ping buffer
│   ├── logger.py                       # System decision logger
│   ├── route_builder.py                # OSRM road geometry fetcher
│   ├── generate_historical_data.py     # Synthetic trip CSV generator
│   ├── train_eta_model.py              # ML model training script
│   ├── requirements.txt                # Python dependencies
│   ├── historical_trips.csv            # (generated) Training data
│   ├── eta_model.pkl                   # (generated) Trained ML model
│   └── feature_importance.png          # (generated) Feature importance plot
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env                            # VITE_MAPBOX_TOKEN (optional, for 3D)
    └── src/
        ├── main.jsx                    # Entry — ThemeProvider + NotificationProvider
        ├── index.css                   # Logista Slate design system (light mode)
        ├── App.jsx                     # Layout: Header → NetworkStrip → Tabs
        ├── context/
        │   ├── ThemeContext.jsx         # Locked to light mode
        │   └── NotificationContext.jsx  # Global notification state
        ├── components/
        │   ├── Header.jsx              # ⚡ Zekrom, tab switcher, bell
        │   ├── NetworkStrip.jsx        # Horizontal health strip (all 5 buses)
        │   ├── NotificationCenter.jsx  # Collapsible notification drawer
        │   ├── MapView.jsx             # Leaflet 2D map (prop-driven, mapId)
        │   ├── MapboxView.jsx          # Mapbox 3D view + inline AI panel
        │   ├── BusSidebar.jsx          # Priority-sorted bus cards
        │   ├── ETATimeline.jsx         # SVG confidence cone timeline
        │   ├── AIDecisionLog.jsx       # AI decisions (mode-aware: live/sim)
        │   ├── SimulationDashboard.jsx # Simulation Lab (scrollable layout)
        │   ├── LayerActivityMonitor.jsx # Layer Activity Monitor container
        │   ├── NetworkPanel.jsx        # (legacy, replaced by NetworkStrip)
        │   ├── MapLegend.jsx           # Leaflet legend control
        │   ├── CompactStatusStrip.jsx  # Bottom bar in 3D mode
        │   ├── TransitionOverlay.jsx   # 2D↔3D transition animation
        │   └── layers/
        │       ├── Layer1Card.jsx      # Adaptive Payload & Frequency
        │       ├── Layer2Card.jsx      # Store & Forward Buffer
        │       ├── Layer3Card.jsx      # Ghost Bus Extrapolation
        │       ├── Layer4Card.jsx      # ML ETA Prediction Engine
        │       ├── Layer5Card.jsx      # Dead Zone Pre-awareness
        │       ├── Layer6Card.jsx      # WebSocket Connection Resilience
        │       ├── LayerCascadeFlow.jsx # SVG inter-layer cascade diagram
        │       └── LayerAIExplanation.jsx # Shared AI explanation panel
        └── hooks/
            ├── useWebSocket.js         # WS hook + 6-layer telemetry ingestion
            ├── useLayerActivity.js      # Layer state computation hook
            ├── useInterpolation.js     # Smooth marker animation
            ├── useSimConfig.js         # Simulation state management
            └── useMapMode.js           # 2D/3D mode switching
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** with pip
- **Node.js 18+** with npm
- A modern browser (Chrome/Edge recommended)
- **Optional:** Mapbox token for 3D view

> ⚠️ If using Conda, run `conda deactivate` before starting the dev server.

### Step 1: Backend Setup

```bash
cd project-zekrom/backend

# Install Python dependencies
pip install -r requirements.txt

# Generate synthetic historical data (800 trip records)
python generate_historical_data.py

# Train the ETA prediction model
python train_eta_model.py

# Start the Zekrom backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Step 2: Frontend Setup

```bash
# Open a NEW terminal
cd project-zekrom/frontend

# (Optional) Add Mapbox token for 3D view
echo "VITE_MAPBOX_TOKEN=pk.your_token_here" > .env

# Install Node dependencies
npm install

# Start the dev server
npm run dev
```

The app opens at **http://localhost:5173**

---

## 🏛️ Architecture Overview

### 6-Layer Resilience Architecture

Zekrom's core innovation is a **6-layer resilience stack** that activates autonomously based on real-time conditions:

| Layer | Name | Trigger | Color |
|-------|------|---------|-------|
| **L1** | Adaptive Payload & Frequency | Signal delta > 15%, packet loss > 20% | 🔵 Blue `#3b82f6` |
| **L2** | Store & Forward Buffer | Signal < 10%, buffer fills | 🟢 Teal `#14b8a6` |
| **L3** | Ghost Bus Extrapolation | Real signal lost | 🟣 Purple `#8b5cf6` |
| **L4** | ML ETA Prediction Engine | Ghost active, ETA recalculated | 🟡 Amber `#f59e0b` |
| **L5** | Dead Zone Pre-awareness | Approaching known dead zone | 🟣 Deep Purple `#7c3aed` |
| **L6** | WebSocket Connection Resilience | Latency > 200ms, reconnecting | 🟢 Green `#22c55e` |

### Layer Cascade Scenarios

| Scenario | Cascade Path | Description |
|----------|-------------|-------------|
| **Rush Hour** | L4 → L1 | ETA recalculates for traffic, ping frequency adapts |
| **Dead Zone** | L5 → L3 → L2 → L1 | Pre-awareness fires, ghost activates, buffer engages, payload compresses |
| **Recovery** | L2 → L3 → L4 → L6 | Buffer flushes, ghost reconciles, ETA stabilizes, connection resumes |
| **Storm** | All Layers | Full system stress, every layer engages simultaneously |

### Data Flow
```
GPS Emitter (5 buses, background tasks)
    │
    ├─ Every 0.5s: advance bus physics
    ├─ Dead zone detection + ghost activation
    ├─ AI Explainability engine logs decisions
    │
    ├─ Per-ping telemetry (~30 fields):
    │   ├─ Core: lat, lng, speed, heading, signal
    │   ├─ L1: payload_size, ping_interval, bandwidth_saved
    │   ├─ L2: buffer_count, is_flushing, flush_progress
    │   ├─ L3: ghost_confidence, confidence_history, deviation
    │   ├─ L4: eta_data_mode, eta_cone_width, eta_confidence
    │   ├─ L5: approaching_dead_zone, distance_km, zone_progress
    │   └─ L6: ws_latency, missed_pings, reconnect_attempt
    │
    ├─ Based on signal_strength:
    │   ├─ ≥70%: emit every 2s (full payload, ~400B)
    │   ├─ 40–70%: emit every 6s (compressed, ~180B)
    │   ├─ 10–40%: emit every 12s (minimal, ~64B)
    │   └─ <10%: buffer pings (dead zone, ~38B ghost)
    │
    └─ WebSocket broadcast → all frontend clients
```

---

## 📺 UI Tabs

### Tab 1: Live Map (2D)
- Real-time 5-bus Leaflet map with trail lines and dead zone overlays
- Priority-sorted bus sidebar with signal bars, speed, heading
- AI Decision Log (filtered to live/non-simulated decisions only)
- ETA Timeline with ML-powered confidence cones

### Tab 2: 3D View (Mapbox)
- Mapbox GL 3D terrain with bus HUD overlay
- Inline AI decision panel filtered per selected bus
- Compact status strip at bottom

### Tab 3: Simulation Lab (Laboratory)
Scrollable control center with the following layout:

```
┌──────────────────────────────────────────────┐
│  COMPACT CONTROL BAR (sticky)                │
│  [TARGET: ALL MIT HIN HAD KAT PUN]          │
│  [Signal ─── Loss ─── Latency ─── ...]      │
│  [SCENARIO: 🚦RUSH  📡DEAD  🔄RECOVERY ⛈STORM]│
├─────────────────────┬────────────────────────┤
│                     │  ⚡ Layer Activity      │
│                     │    Monitor             │
│   SIMULATION MAP    │  ┌ Cascade Flow SVG ┐  │
│       (70%)         │  ├ L1: Adaptive ────┤  │
│                     │  ├ L2: Buffer ──────┤  │
│                     │  ├ L3: Ghost ───────┤  │
│                     │  ├ L4: ETA ─────────┤  │
│                     │  ├ L5: Dead Zone ───┤  │
├─────────────────────┤  └ L6: WebSocket ───┘  │
│  ETA Timeline (70%) │     (30%, expands)     │
└─────────────────────┴────────────────────────┘
```

**Layer Activity Monitor features:**
- **Bus Selector** — auto-selects most critical bus or manual override
- **Cascade Flow SVG** — animated arrows + pulsing nodes showing inter-layer triggering
- **6 Layer Cards** — each shows:
  - Active/idle status badge (color-coded per layer)
  - Trigger reason and internal decision logic
  - Real-time data (charts, bars, tables)
  - AI Explanation panel with timestamped decisions
- **Scenario Banner** — shows active scenario and expected cascade path

---

## 🎨 Design System — "Logista Slate"

- **Mode:** Light mode only (permanently locked)
- **Glassmorphism:** `rgba(255,255,255,0.4)` background, `blur(16px)`, frosted borders
- **Typography:** Inter, system-ui
- **Accent Colors:** Indigo `#6366f1`, Emerald `#10b981`
- **Signal Colors:** Green `#22c55e`, Amber `#f59e0b`, Red `#ef4444`
- **Cards:** `.glass-card` with `backdrop-filter: blur(16px)`, subtle box shadows
- **Animations:** `layerActivate` flash, `cascadePulse`, `aiEntryFlash`, `signal-blink`

---

## 🧪 Testing Scenarios

### Test 1: Normal Operation
1. Open the app → 5 bus markers moving on map
2. Network strip shows green signal for all buses
3. ETA Timeline shows narrow green confidence cone

### Test 2: Signal Degradation
1. Switch to **Laboratory** tab
2. Drag **Signal** → 30%
3. Observe: Layer 1 activates (ping interval extends), ETA cone widens

### Test 3: Dead Zone Scenario
1. Click **📡 DEAD ZONE** preset
2. Observe cascade: L5 (Dead Zone) → L3 (Ghost) → L2 (Buffer) → L1 (Adaptive)
3. Layer cards expand with real-time data + AI explanations
4. Cascade Flow SVG shows animated arrows lighting up

### Test 4: Recovery Scenario
1. Click **🔄 RECOVERY** preset
2. 5-second countdown, then signal restores
3. Watch reverse cascade: L2 flushes → L3 reconciles → L4 stabilizes

### Test 5: Storm Scenario
1. Click **⛈ STORM** preset
2. All 6 layers activate simultaneously
3. Full cascade visible in SVG diagram

### Test 6: Layer AI Explanations
1. Trigger any scenario
2. Each layer card shows 🤖 AI Explanation section
3. Timestamped decisions with reasoning and action

### Test 7: Notifications
1. Trigger Dead Zone preset → bell badge increments
2. Click 🔔 → drawer opens with ghost/dead zone notifications
3. Note: simulated events do NOT pollute Live section notifications

### Test 8: 3D AI Decisions
1. Click "Track in 3D" on any bus card
2. AI Decisions panel appears filtered to that bus only

---

## 🔌 Backend Endpoints

| Method | Path | Description |
|--------|------|-------------|
| WS | `/ws/client` | Real-time bus position stream (~30 fields/ping) |
| GET | `/api/routes` | Route geometries for all 5 routes |
| GET | `/api/buses` | Current state of all 5 buses |
| GET | `/api/dead-zones` | Dead zone definitions |
| GET | `/api/trip-status` | Trip progress (optional `?bus_id=`) |
| GET | `/api/system-log` | AI decision log (optional `?bus_id=`) |
| GET | `/api/layer-status/{bus_id}` | **Phase 8:** Computed state of all 6 layers |
| POST | `/api/signal` | Set signal for specific bus |
| POST | `/api/sim-config` | Apply simulation parameters |
| POST | `/api/predict-eta` | ML-based ETA prediction |

---

## 🚌 5-Bus Fleet

| Bus | Route | Color |
|-----|-------|-------|
| MIT-01 | Pune Station → MITAOE | Purple |
| HIN-02 | Hinjewadi → MITAOE | Teal |
| HAD-03 | Hadapsar → MITAOE | Orange |
| KAT-04 | Katraj → MITAOE | Crimson |
| PUN-05 | Pimpri → MITAOE | Amber |

## 📡 Dead Zones

| Zone | Severity | Signal | Route |
|------|----------|--------|-------|
| Katraj Ghat | Blackout | 0-5% | KAT-04 stops 3-5 |
| Nanded Outskirts | Weak | 15-30% | MIT-01 stops 4-6 |
| Bhosari Industrial | Weak | 20-35% | PUN-05 stops 2-4 |
| Moshi Highway | Blackout | 0-8% | HAD-03 stops 5-7 |

---

## 📋 Phase History

| Phase | Features |
|-------|----------|
| **1** | Single bus GPS simulation, Leaflet map |
| **2** | Dead zones, ghost bus extrapolation, store-and-forward buffer |
| **3** | 5-bus fleet, OSRM road geometry, multi-route tracking |
| **4** | ML ETA prediction (GradientBoosting), confidence cones |
| **5** | AI Decision Explainability engine, system decision logging |
| **6** | Zekrom branding, dark/light mode, notification center, 70:30 layout |
| **7** | Logista Slate UI overhaul, glassmorphism, AI log isolation (live vs sim) |
| **8** | **Layer Activity Monitor** — 6-layer resilience visualization, cascade flow, per-layer AI explanations, scrollable simulation lab |

---

## ⚠️ Notes
- All routes converge at **MITAOE (18.6828°N, 74.1190°E)**
- Uses **CARTO Voyager** tiles and **OSRM** for road geometry
- Optional **Mapbox** token enables 3D view
- The entire system runs locally — no paid APIs required
- ML model (`eta_model.pkl`) must be generated before starting backend
- Always run `conda deactivate` before starting the dev server if using Conda
- Design system is permanently locked to **light mode** (Logista Slate)
