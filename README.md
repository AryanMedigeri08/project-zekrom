# ⚡ Zekrom — Resilient Fleet Monitor

> Real-time college bus tracking that works reliably under low bandwidth, high latency, and complete signal loss.

---

## 📁 Project Structure

```
project-zekrom/
├── backend/
│   ├── main.py                         # Zekrom API (FastAPI + WebSocket)
│   ├── config.py                       # 5 routes, 5 buses, MITAOE destination
│   ├── gps_emitter.py                  # Multi-bus GPS simulation + ghost logic
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
        ├── index.css                   # Full theme system (dark/light CSS vars)
        ├── App.jsx                     # Layout: Header → NetworkStrip → Tabs
        ├── context/
        │   ├── ThemeContext.jsx         # Light/Dark mode system
        │   └── NotificationContext.jsx  # Global notification state
        ├── components/
        │   ├── Header.jsx              # ⚡ Zekrom, tab switcher, bell, theme
        │   ├── NetworkStrip.jsx        # Horizontal health strip (all 5 buses)
        │   ├── NotificationCenter.jsx  # Collapsible notification drawer
        │   ├── MapView.jsx             # Leaflet 2D map (prop-driven, mapId)
        │   ├── MapboxView.jsx          # Mapbox 3D view + inline AI panel
        │   ├── BusSidebar.jsx          # Priority-sorted bus cards
        │   ├── ETATimeline.jsx         # SVG confidence cone timeline
        │   ├── AIDecisionLog.jsx       # Newest-first AI decisions + NEW badge
        │   ├── SimulationDashboard.jsx # Full Simulation Lab (70:30 map+controls)
        │   ├── NetworkPanel.jsx        # (legacy, replaced by NetworkStrip)
        │   ├── MapLegend.jsx           # Leaflet legend control
        │   ├── CompactStatusStrip.jsx  # Bottom bar in 3D mode
        │   └── TransitionOverlay.jsx   # 2D↔3D transition animation
        └── hooks/
            ├── useWebSocket.js         # WS hook + notification callbacks
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

## ⚡ Phase 6 Features

### Zekrom Branding
- All references rebranded to "Zekrom"
- ⚡ emoji favicon, Zekrom API v6.0.0 backend

### Dark / Light Mode
- Full theme system with CSS variables
- Toggle via ☀️/🌑 button in header
- Auto-persists to localStorage
- Mapbox tiles switch between dark-v11 / light-v11
- Leaflet tiles switch between CARTO dark / voyager

### Notification Center
- 🔔 bell with unread badge in header
- Collapsible drawer with filter tabs (All / AI / System / Alerts)
- Auto-populates from WebSocket events + AI decisions
- Mark read / Clear all controls

### Network Health Strip
- Persistent strip below navbar showing all 5 buses inline
- Mini sparkline + signal % or ghost indicator per bus
- Always visible across all tabs and modes

### 70:30 Layout
- Map takes 70% width, sidebar takes 30%
- Applies to both Live Map and Simulation Lab
- Map fills full available height (no aspect-ratio constraint)

### Simulation Lab — Full Map Parity
- Same MapView used in both Live and Simulation tabs
- All 13 visual features work in sim map (bus icons, dead zones, trails, etc.)
- "⚡ SIMULATION MODE" badge + live parameter readout overlay

### AI Decisions
- Newest-first ordering with sort toggle
- "NEW" badge with pulse animation (10s)
- Inline AI panel in 3D MapboxView (filtered to selected bus)

---

## 🧪 Testing Scenarios

### Test 1: Normal Operation
1. Open the app → 5 bus markers moving on map
2. Network strip shows green signal for all buses
3. ETA Timeline shows narrow green confidence cone

### Test 2: Signal Degradation
1. Switch to **Simulation Lab** tab
2. Drag **Signal Strength** → 30%
3. Observe: ping interval jumps, waveform turns orange, ETA cone widens

### Test 3: Dead Zone + Buffer Flush
1. Click **Dead Zone** preset
2. Observe: ghost bus appears, buffer climbing, signal lost overlays
3. Click **Rush Hour** → buffer flushes, ghost deactivates

### Test 4: Recovery Scenario
1. Click **Recovery** preset
2. Countdown 5→1, dead zone then auto-recovery

### Test 5: Theme Toggle
1. Click ☀️ in header → switches to light mode
2. Map tiles change, all panels recolor
3. Click 🌑 → returns to dark mode

### Test 6: Notifications
1. Trigger Dead Zone preset → bell badge increments
2. Click 🔔 → drawer opens with ghost/dead zone/signal notifications
3. Click entry to mark read, or use "Mark all read"

### Test 7: 3D AI Decisions
1. Click "Track in 3D" on any bus card
2. AI Decisions panel appears below Bus HUD (right side)
3. Only shows decisions for that specific bus

---

## 🏗️ Architecture

### Data Flow
```
GPS Emitter (5 buses, background tasks)
    │
    ├─ Every 0.5s: advance bus physics
    ├─ Dead zone detection + ghost activation
    ├─ AI Explainability engine logs decisions
    │
    ├─ Based on signal_strength:
    │   ├─ ≥70%: emit every 2s (full payload)
    │   ├─ 40–70%: emit every 6s (compressed)
    │   ├─ 10–40%: emit every 12s (minimal)
    │   └─ <10%: buffer pings (dead zone)
    │
    └─ WebSocket broadcast → all frontend clients
```

### Backend Endpoints
| Method | Path | Description |
|--------|------|-------------|
| WS | `/ws/client` | Real-time bus position stream |
| GET | `/api/routes` | Route geometries for all 5 routes |
| GET | `/api/buses` | Current state of all 5 buses |
| GET | `/api/dead-zones` | Dead zone definitions |
| GET | `/api/trip-status` | Trip progress (optional ?bus_id=) |
| GET | `/api/system-log` | AI decision log (optional ?bus_id=) |
| POST | `/api/signal` | Set signal for specific bus |
| POST | `/api/sim-config` | Apply simulation parameters |
| POST | `/api/predict-eta` | ML-based ETA prediction |

### 5-Bus Fleet
| Bus | Route | Color |
|-----|-------|-------|
| MIT-01 | Pune Station → MITAOE | Purple |
| HIN-02 | Hinjewadi → MITAOE | Teal |
| HAD-03 | Hadapsar → MITAOE | Orange |
| KAT-04 | Katraj → MITAOE | Crimson |
| PUN-05 | Pimpri → MITAOE | Amber |

### Dead Zones
| Zone | Severity | Signal | Route Indices |
|------|----------|--------|---------------|
| Katraj Ghat | Blackout | 0-5% | KAT-04 stops 3-5 |
| Nanded Outskirts | Weak | 15-30% | MIT-01 stops 4-6 |
| Bhosari Industrial | Weak | 20-35% | PUN-05 stops 2-4 |
| Moshi Highway | Blackout | 0-8% | HAD-03 stops 5-7 |

---

## ⚠️ Notes
- All routes converge at **MITAOE (18.6828°N, 74.1190°E)**
- Uses **CARTO** tiles (dark/light) and **OSRM** for road geometry
- Optional **Mapbox** token enables 3D view
- The entire system runs locally — no paid APIs
- ML model (`eta_model.pkl`) must be generated before starting backend
