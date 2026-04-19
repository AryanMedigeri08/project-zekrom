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
    ├── .env                            # VITE_MAPBOX_TOKEN (must be created manually)
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
OR
echo "VITE_MAPBOX_TOKEN=pk.eyJ1IjoiMjAyNDAxMTIwMDIwIiwiYSI6ImNtbzVweWFjeDA0dmYyb3NodGNtajBtenEifQ.HJMpW5ol_TTAYmUg2Ay2Hw" > .env

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

### Dual Simulation Architecture

Zekrom runs **two completely independent simulation systems** that share no state:

| | Live Map | Simulation Lab |
|---|---|---|
| **Purpose** | Production-like autonomous tracking | Testing & experimentation |
| **WebSocket** | `/ws/live` | `/ws/lab` |
| **Signal Source** | `AutonomousSignalModel` (route geography) | Sliders & scenario presets |
| **Slider Control** | ❌ Never affected | ✅ Full control |

### 6-Layer Resilience Architecture

| Layer | Name | Trigger |
|-------|------|---------|
| **L1** | Adaptive Payload & Frequency | Signal delta > 15%, packet loss > 20% |
| **L2** | Store & Forward Buffer | Signal < 10%, buffer fills |
| **L3** | Ghost Bus Extrapolation | Real signal lost |
| **L4** | ML ETA Prediction Engine | Ghost active, ETA recalculated |
| **L5** | Dead Zone Pre-awareness | Approaching known dead zone |
| **L6** | WebSocket Connection Resilience | Latency > 200ms, reconnecting |

### Key Design Decisions

- **Distance-Based Movement:** Buses use a monotonically increasing `distance_traveled_km` float with route geometry pre-computed as a cumulative distance lookup table. Position is found via binary search + linear interpolation. Distance only ever increases.
- **Ghost Reconciliation:** On signal restoration, `distance_traveled_km = ghost_distance_km` — the bus continues from the ghost's predicted position and **never snaps backward**.

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
