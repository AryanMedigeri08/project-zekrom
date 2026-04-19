# ⚡ Zekrom — Resilient Fleet Monitor

> Real-time college bus tracking that works reliably under low bandwidth, high latency, and complete signal loss — with full transparency into every internal decision.

---

## 📁 Project Structure

```
project-zekrom/
├── backend/
│   ├── main.py                         # Zekrom API — auto-setup, dual WS, all endpoints
│   ├── config.py                       # 5 routes, 5 buses, MITAOE destination
│   ├── gps_emitter.py                  # Dual emitter: LiveBusEmitter + LabBusEmitter
│   ├── simulation_state.py             # BusSimState, distance lookup table, haversine
│   ├── autonomous_signal.py            # Autonomous signal model for Live Map
│   ├── dead_zones.py                   # Dead zone definitions + helpers
│   ├── explainer.py                    # AI Decision Explainability engine
│   ├── buffer.py                       # Store-and-forward ping buffer
│   ├── logger.py                       # System decision logger
│   ├── route_builder.py                # OSRM road geometry fetcher
│   ├── generate_historical_data.py     # Synthetic trip CSV generator (auto-runs)
│   ├── train_eta_model.py              # ML model training script (auto-runs)
│   ├── requirements.txt                # Python dependencies
│   ├── historical_trips.csv            # (auto-generated) Training data
│   ├── eta_model.pkl                   # (auto-generated) Trained ML model
│   └── feature_importance.png          # (auto-generated) Feature importance plot
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env                            # VITE_MAPBOX_TOKEN (create manually, gitignored)
    └── src/
        ├── main.jsx                    # Entry — ThemeProvider + NotificationProvider
        ├── index.css                   # Logista Slate design system (light mode)
        ├── App.jsx                     # Dual WS: Live (/ws/live) + Lab (/ws/lab)
        ├── context/
        │   ├── ThemeContext.jsx         # Locked to light mode
        │   └── NotificationContext.jsx  # Global notification state
        ├── components/
        │   ├── Header.jsx              # ⚡ Zekrom, tab switcher, bell
        │   ├── NetworkStrip.jsx        # Horizontal health strip (all 5 buses)
        │   ├── NotificationCenter.jsx  # Collapsible notification drawer
        │   ├── MapView.jsx             # Leaflet 2D map (zoom 13, distance-based)
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
            ├── useWebSocket.js         # Dual WS hook ('live' or 'lab' endpoint)
            ├── useLayerActivity.js      # Layer state computation hook
            ├── useInterpolation.js     # Smooth rAF marker animation
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

### Step 1: Backend

```bash
cd project-zekrom/backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install Python dependencies
pip install -r requirements.txt

# Start (auto-generates data + trains ML model on first run)
python main.py
```

> That's it — **one command** starts everything. On first run, the server automatically:
> 1. Generates `historical_trips.csv` (800 synthetic trip records)
> 2. Trains the ETA prediction model (`eta_model.pkl`)
> 3. Fetches OSRM road geometry for all 5 routes
> 4. Launches 10 bus emitters (5 live + 5 lab)
> 5. Starts the API server on `http://localhost:8000`

### Step 2: Frontend

```bash
# Open a NEW terminal
cd project-zekrom/frontend

# Create .env file with your Mapbox token (required for 3D view)
echo "VITE_MAPBOX_TOKEN=pk.eyJ1IjoiMjAyNDAxMTIwMDIwIiwiYSI6ImNtbzQxZ2VjZTE2b3gycXF3NjJhMGEwbXcifQ.vCeSd97F_Us7ja-Tulh4ig" > .env

# Install Node dependencies
npm install

# Start the dev server
npm run dev
```

> **Note:** The `.env` file is **gitignored** and must be created manually. Get a free Mapbox token from [mapbox.com/account/access-tokens](https://account.mapbox.com/access-tokens/). The 3D view will not work without it.

> **⚠️ Important:** The `.env` file **must be saved in UTF-8 encoding**. If it is saved in a different encoding (e.g., UTF-16), the Mapbox token will not be read correctly and the **3D map will fail to load**. In VS Code, check the encoding in the bottom-right status bar and click it to change to `UTF-8` if needed.

The app opens at **http://localhost:5173**

---

## 🏛️ Architecture Overview

### Phase 9 — Dual Simulation Architecture

Zekrom runs **two completely independent simulation systems** that share no state:

| | Live Map | Simulation Lab |
|---|---|---|
| **Purpose** | Production-like autonomous tracking | Testing & experimentation |
| **WebSocket** | `/ws/live` | `/ws/lab` |
| **Signal Source** | `AutonomousSignalModel` (route geography) | Sliders & scenario presets |
| **Emitter Class** | `LiveBusEmitter` | `LabBusEmitter` |
| **State Store** | `live_emitters{}` | `lab_emitters{}` |
| **Slider Control** | ❌ Never affected | ✅ Full control |
| **Ghost Activation** | Automatic (dead zones fire by geography) | Manual (signal slider → 0%) |

### Distance-Based Movement

Buses use a **monotonically increasing** `distance_traveled_km` float — never an index that bounces back and forth. Route geometry is pre-computed as a cumulative distance lookup table at startup. Position at any distance is found via binary search + linear interpolation.

**Key invariant:** `distance_traveled_km` only ever increases. When a trip completes, it wraps via modulo and `trip_number` increments.

### Ghost Reconciliation (No Backward Snap)

When signal is lost, the ghost bus continues advancing `ghost_distance_km` forward along the route. On signal restoration:
1. `distance_traveled_km = ghost_distance_km` (accept ghost position as real)
2. Buffer flush broadcasts all stored pings
3. Bus continues forward — **never snaps back** to blackout start

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
GPS Emitters (5 buses × 2 modes = 10 tasks)
    │
    ├─ LIVE emitters (autonomous signal model)
    │   └─ broadcast → /ws/live clients
    │
    ├─ LAB emitters (slider-controlled)
    │   └─ broadcast → /ws/lab clients
    │
    ├─ Per-ping telemetry (~30 fields):
    │   ├─ Core: lat, lng, speed, heading, signal, distance_km
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
    └─ Independent heartbeats every 1s to both WS channels
```

---

## 📺 UI Tabs

### Tab 1: Live Map (2D)
- Real-time 5-bus Leaflet map with trail lines and dead zone overlays
- **Autonomous signal** — buses enter ghost mode naturally in dead zones
- Priority-sorted bus sidebar with signal bars, speed, heading
- AI Decision Log (filtered to live/non-simulated decisions only)
- ETA Timeline with ML-powered confidence cones
- Default zoom level 13 (city-scale, movement clearly visible)

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

> **Important:** Lab sliders and scenarios only affect the Lab map. The Live Map runs independently with its own autonomous signal model.

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

### Test 1: Forward Movement (Bug 1 Fix)
1. Open Live Map → watch KAT-04 (Katraj route)
2. Bus moves **continuously forward** along the route
3. When trip completes, it wraps to start with `trip_number` incrementing
4. **Expected:** No back-and-forth bouncing. Distance only increases.

### Test 2: Live vs Lab Independence (Bug 3 Fix)
1. Open **Laboratory** tab → drag Signal to 0%
2. Lab buses enter ghost mode
3. Switch to **Live Map** tab
4. **Expected:** Live buses still have normal signal — completely unaffected

### Test 3: Autonomous Ghost on Live Map
1. Watch Live Map → KAT-04 enters Katraj Ghat dead zone automatically
2. Ghost mode activates without any slider interaction
3. Ghost confidence decays over time
4. **Expected:** Purple ghost indicator on KAT-04, buffer filling

### Test 4: Ghost Reconciliation (Bug 4 Fix)
1. In Lab, trigger **📡 DEAD ZONE** preset
2. Wait for ghost bus to travel forward
3. Click **🔄 RECOVERY** preset
4. **Expected:** Bus continues from ghost position. No backward snap.

### Test 5: Dead Zone Scenario
1. Click **📡 DEAD ZONE** preset in Lab
2. Observe cascade: L5 (Dead Zone) → L3 (Ghost) → L2 (Buffer) → L1 (Adaptive)
3. Layer cards expand with real-time data + AI explanations
4. Cascade Flow SVG shows animated arrows lighting up

### Test 6: Storm Scenario
1. Click **⛈ STORM** preset in Lab
2. All 6 layers activate simultaneously
3. Full cascade visible in SVG diagram

### Test 7: Layer AI Explanations
1. Trigger any scenario in Lab
2. Each layer card shows 🤖 AI Explanation section
3. Timestamped decisions with reasoning and action

### Test 8: Notifications
1. Trigger Dead Zone preset → bell badge increments
2. Click 🔔 → drawer opens with ghost/dead zone notifications
3. Note: simulated events do NOT pollute Live section notifications

### Test 9: 3D AI Decisions
1. Click "Track in 3D" on any bus card
2. AI Decisions panel appears filtered to that bus only

---

## 🔌 Backend Endpoints

| Method | Path | Description |
|--------|------|-------------|
| WS | `/ws/live` | **Live Map** — autonomous bus stream (no slider control) |
| WS | `/ws/lab` | **Lab Map** — slider-controlled bus stream |
| WS | `/ws/client` | Legacy endpoint (forwards to `/ws/live`) |
| GET | `/api/routes` | Route geometries for all 5 routes |
| GET | `/api/buses` | Current state of all 5 buses (live) |
| GET | `/api/dead-zones` | Dead zone definitions |
| GET | `/api/trip-status` | Trip progress (optional `?bus_id=`) |
| GET | `/api/system-log` | AI decision log (optional `?bus_id=`) |
| GET | `/api/layer-status/{bus_id}` | Computed state of all 6 layers (Lab) |
| POST | `/api/signal` | Set signal for specific bus (**Lab only**) |
| POST | `/api/sim-config` | Apply simulation parameters (**Lab only**) |
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
| **9** | **Dual Architecture** — distance-based movement (no index bouncing), independent Live/Lab simulations (`/ws/live` + `/ws/lab`), autonomous signal model, forward-only ghost reconciliation, auto-setup on startup |

---

## ⚠️ Notes
- All routes converge at **MITAOE (18.6828°N, 74.1190°E)**
- Uses **CARTO Voyager** tiles and **OSRM** for road geometry
- **Mapbox** token for 3D view must be added manually to `frontend/.env` (see Quick Start)
- The entire system runs locally — no paid APIs required
- ML model and training data are **auto-generated** on first `python main.py` run
- Always activate the **virtual environment** (`venv\Scripts\activate`) before running
- If using Conda, run `conda deactivate` before starting
- Design system is permanently locked to **light mode** (Logista Slate)
