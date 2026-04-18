# Zekrom — Resilient Public Transport Tracking System

> **ThinkRoot × Vortex Hackathon 2026 · Track B**
> Real-time college bus tracking that works reliably under low bandwidth, high latency, and complete signal loss.

---

## 📁 Project Structure

```
project-zekrom/
├── backend/
│   ├── main.py                         # FastAPI server (WebSocket + REST)
│   ├── config.py                       # Route waypoints, SimConfig, constants
│   ├── gps_emitter.py                  # Synthetic bus movement engine
│   ├── buffer.py                       # Store-and-forward ping buffer
│   ├── logger.py                       # System decision logger
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
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx
        ├── components/
        │   ├── MapView.jsx             # Leaflet map with bus/ghost markers
        │   ├── NetworkPanel.jsx        # Signal waveform (Recharts)
        │   ├── StatusBar.jsx           # System state + signal control
        │   ├── SimulationDashboard.jsx # What-If control panel
        │   └── ETATimeline.jsx         # SVG confidence cone timeline
        └── hooks/
            ├── useWebSocket.js         # Auto-reconnecting WebSocket
            ├── useInterpolation.js     # Smooth marker animation
            └── useSimConfig.js         # Simulation state management
```

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10+** with pip
- **Node.js 18+** with npm
- A modern browser (Chrome/Edge recommended)

### Step 1: Backend Setup

```bash
cd project-zekrom/backend

# Install Python dependencies
pip install -r requirements.txt

# Generate synthetic historical data (800 trip records)
python generate_historical_data.py

# Train the ETA prediction model
python train_eta_model.py

# Start the backend server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Expected output from training:**
```
Loaded 800 records from historical_trips.csv
Train: 640  |  Test: 160

=======================================================
Model                        RMSE        MAE
-------------------------------------------------------
GradientBoostingRegressor      X.XXX      X.XXX
LinearRegression (baseline)    X.XXX      X.XXX
=======================================================

✓ Best model: GradientBoostingRegressor
✓ Model saved to eta_model.pkl
✓ Feature importance plot saved to feature_importance.png
```

### Step 2: Frontend Setup

```bash
# Open a NEW terminal
cd project-zekrom/frontend

# Install Node dependencies
npm install

# Start the dev server
npm start
```

The app opens at **http://localhost:5173**

---

## 🧪 Testing Scenarios

### Test 1: Normal Operation
1. Open the app → bus marker should be moving smoothly on the dark map
2. Network waveform should show green ~85% signal
3. ETA Timeline should show a narrow green confidence cone
4. Status bar should show 2s ping interval

### Test 2: Signal Degradation
1. Go to **🧪 Simulation** tab
2. Drag **Signal Strength** slider from 85% → 30%
3. **Observe:**
   - Ping interval jumps from 2s → 12s
   - Waveform turns orange and flattens
   - ETA cone widens to medium (yellow)
   - System log shows: "Signal ↓ to 30%. Switching to sparse mode."

### Test 3: Dead Zone + Buffer Flush
1. Click the **📡 Dead Zone** preset button
2. **Observe within 5 seconds:**
   - Signal drops to 0%, waveform flatlines → "SIGNAL LOST"
   - Ghost bus appears (translucent marker) with "Estimated Position"
   - Buffer counter starts climbing (visible in Status Bar)
   - ETA cone turns red and widens
   - System log: "Signal dropped to 0%. Entering dead zone."
3. Click the **🚦 Rush Hour** preset (or slide signal back to 85%)
4. **Observe:**
   - Buffer flushes — orange dashed path appears on map
   - Ghost bus disappears, real marker snaps to actual position
   - System log: "Signal restored. Flushing X buffered pings."

### Test 4: Recovery Scenario (Animated)
1. Click the **🔄 Recovery** preset button
2. **Observe:**
   - Countdown timer appears on the button: 5… 4… 3… 2… 1…
   - First, system enters dead zone (same as Test 3)
   - After 5 seconds, automatically recovers to normal
   - Buffer flush, ghost deactivation, waveform recovery all happen live

### Test 5: Storm Conditions
1. Click the **⛈️ Storm Conditions** preset
2. **Observe:**
   - Signal at 35%, waveform degraded (orange)
   - Bus speed down to 20 km/h, traffic = High, weather = Rain
   - ETA significantly longer (rain + traffic penalties)
   - Confidence cone turns wide (red)
   - System log shows all parameter changes

### Test 6: What-If Slider Interaction
1. In Simulation tab, drag sliders individually:
   - **Packet Loss** → watch pings/minute decrease
   - **Bus Speed** → watch bus speed change on map immediately
   - **Buffer Capacity** → change the max buffer size
2. Right column metrics update within 500ms of each change

---

## 🏗️ Architecture Overview

### Data Flow
```
GPS Emitter (background task)
    │
    ├─ Every 0.5s: advance bus physics
    │
    ├─ Based on SimConfig.signal_strength:
    │   ├─ ≥70%: emit every 2s (full payload)
    │   ├─ 40–70%: emit every 6s (compressed)
    │   ├─ 10–40%: emit every 12s (minimal)
    │   └─ <10%: buffer pings (dead zone)
    │
    ├─ Heartbeat every 1s (always, for waveform)
    │
    └─ WebSocket broadcast → all frontend clients
```

### Backend Endpoints
| Method | Path | Description |
|--------|------|-------------|
| WS | `/ws/client` | Frontend WebSocket connection |
| GET | `/api/bus-state` | Current bus position + signal |
| GET | `/api/route` | Full route waypoint data |
| GET | `/api/trip-status` | Trip progress, stops, distance |
| GET | `/api/system-log` | Last 20 system decision entries |
| POST | `/api/signal` | Set signal strength (0–100) |
| POST | `/api/sim-config` | Apply full simulation config |
| POST | `/api/predict-eta` | ML-based ETA prediction |

### ML Model
- **Algorithm:** GradientBoostingRegressor (scikit-learn)
- **Features:** departure_time, day_of_week, traffic_level, avg_signal_strength, weather, num_passengers
- **Target:** actual_travel_time_minutes
- **Training data:** 800 synthetic trips with realistic correlations

### Confidence Intervals
| Signal Range | Margin | Cone Width |
|-------------|--------|------------|
| 70–100% | ±15% | Narrow (green) |
| 40–70% | ±25% | Medium (yellow) |
| 0–40% | ±40% | Wide (red) |

---

## 🔑 Key Features by Judging Criteria

### System Resilience (30%)
- Adaptive ping frequency (2s → 6s → 12s → buffer)
- Store-and-forward buffer with configurable capacity
- Automatic buffer flush on signal recovery
- Ghost bus extrapolation during complete signal loss
- WebSocket auto-reconnect with exponential backoff

### ETA Accuracy (25%)
- GradientBoosting ML model trained on 800 synthetic trips
- Confidence intervals that widen with signal degradation
- Signal penalty detection and reporting
- Live re-prediction every 10 seconds

### Technical Architecture (20%)
- Cubic ease-out interpolation for smooth marker movement
- Dead-reckoning ghost bus using last known heading + speed
- Debounced sim-config pushes (300ms)
- Ring-buffer system decision logger
- Haversine distance + bearing calculations

### User Experience (10%)
- Dark-themed UI with glassmorphism panels
- SVG confidence cone on ETA timeline
- Animated scenario presets with countdown
- Real-time waveform visualization
- Color-coded system state (green/yellow/red)

---

## ⚠️ Notes
- All coordinates are around **MIT Academy of Engineering, Pune (Alandi Road)**
- No paid APIs — uses **OpenStreetMap / CARTO dark tiles**
- The entire system runs locally — no external dependencies at runtime
- The ML model file (`eta_model.pkl`) must be generated before starting the backend
