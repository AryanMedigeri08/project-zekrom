"""
Synthetic Historical Trip Data Generator.

Generates historical_trips.csv with 800 rows of simulated college bus trip data.
Each row represents one completed trip from Nigdi to MIT AOE with realistic
correlations between features (time of day, traffic, weather, signal) and the
target variable (actual travel time in minutes).

Usage:
    python generate_historical_data.py
"""

import csv
import random
import math
import os
from datetime import datetime

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "historical_trips.csv")
NUM_ROWS = 800
BASE_TRAVEL_TIME = 28.0  # minutes — normal conditions, no traffic

# Rush-hour windows (24h format)
RUSH_HOURS_MORNING = (8, 10)   # 08:00–10:00
RUSH_HOURS_EVENING = (17, 19)  # 17:00–19:00

COLUMNS = [
    "trip_id",
    "departure_time",      # hour of day (0–23)
    "day_of_week",         # 0=Monday … 6=Sunday
    "traffic_level",       # 0=low, 1=medium, 2=high
    "avg_signal_strength", # 0–100
    "num_passengers_approx",  # 10–60
    "weather",             # 0=clear, 1=cloudy, 2=rain
    "actual_travel_time_minutes",  # target
]

random.seed(42)  # reproducibility


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_rush_hour(hour: int) -> bool:
    """Check whether the departure hour falls in a rush-hour window."""
    return (RUSH_HOURS_MORNING[0] <= hour < RUSH_HOURS_MORNING[1] or
            RUSH_HOURS_EVENING[0] <= hour < RUSH_HOURS_EVENING[1])


def is_weekend(day: int) -> bool:
    """Saturday=5, Sunday=6."""
    return day >= 5


def generate_row(trip_id: int) -> dict:
    """
    Generate a single trip record with realistic correlations.

    Logic:
      1. Pick a departure hour — biased toward morning/evening college times
      2. Pick day of week — uniform
      3. Derive traffic level from time + day (rush hours → high traffic,
         weekends → low traffic, else medium with randomness)
      4. Signal strength — random 20–100, with occasional dips
      5. Weather — weighted: 60% clear, 25% cloudy, 15% rain
      6. Passengers — correlates with rush hour (more passengers) and weekend
      7. Compute actual travel time from all features
    """

    # ---- Departure time (biased toward realistic college bus hours) ----
    hour_weights = [0] * 24
    for h in range(6, 22):  # buses run 06:00–21:00
        hour_weights[h] = 1
    for h in range(7, 11):  # more trips in morning
        hour_weights[h] = 4
    for h in range(16, 20):  # more trips in evening
        hour_weights[h] = 3
    departure_time = random.choices(range(24), weights=hour_weights, k=1)[0]

    # ---- Day of week ----
    day_of_week = random.randint(0, 6)

    # ---- Traffic level (correlated with time and day) ----
    if is_weekend(day_of_week):
        # Weekends: mostly low traffic
        traffic_level = random.choices([0, 1, 2], weights=[0.65, 0.30, 0.05], k=1)[0]
    elif is_rush_hour(departure_time):
        # Rush hour weekday: mostly high traffic
        traffic_level = random.choices([0, 1, 2], weights=[0.05, 0.25, 0.70], k=1)[0]
    else:
        # Normal weekday
        traffic_level = random.choices([0, 1, 2], weights=[0.30, 0.50, 0.20], k=1)[0]

    # ---- Signal strength ----
    # Mostly decent (50–100), occasionally poor (20–50)
    if random.random() < 0.15:
        avg_signal_strength = random.randint(10, 45)  # poor signal trip
    else:
        avg_signal_strength = random.randint(50, 100)

    # ---- Weather ----
    weather = random.choices([0, 1, 2], weights=[0.60, 0.25, 0.15], k=1)[0]

    # ---- Passengers (correlates with rush hour) ----
    if is_rush_hour(departure_time):
        num_passengers_approx = random.randint(35, 60)
    elif is_weekend(day_of_week):
        num_passengers_approx = random.randint(10, 30)
    else:
        num_passengers_approx = random.randint(15, 45)

    # ---- Compute actual travel time ----
    travel_time = BASE_TRAVEL_TIME

    # Rush-hour penalty: 20–35% longer
    if is_rush_hour(departure_time) and not is_weekend(day_of_week):
        rush_factor = random.uniform(1.20, 1.35)
        travel_time *= rush_factor

    # Traffic level impact
    if traffic_level == 1:
        travel_time += random.uniform(2, 6)
    elif traffic_level == 2:
        travel_time += random.uniform(5, 12)

    # Weekend discount: 30% less traffic effect (faster trips)
    if is_weekend(day_of_week):
        travel_time *= random.uniform(0.70, 0.85)

    # Rain penalty: +5–15 minutes
    if weather == 2:
        travel_time += random.uniform(5, 15)
    elif weather == 1:
        travel_time += random.uniform(0, 3)  # cloudy — minor

    # Low signal penalty: +2–5 minutes (driver uncertainty, missed turns)
    if avg_signal_strength < 40:
        travel_time += random.uniform(2, 5)

    # High passenger count → slightly slower (more stop dwell time)
    if num_passengers_approx > 45:
        travel_time += random.uniform(1, 3)

    # Gaussian noise for realism
    travel_time += random.gauss(0, 3)

    # Clamp to realistic range
    travel_time = max(18, min(65, round(travel_time, 1)))

    return {
        "trip_id": trip_id,
        "departure_time": departure_time,
        "day_of_week": day_of_week,
        "traffic_level": traffic_level,
        "avg_signal_strength": avg_signal_strength,
        "num_passengers_approx": num_passengers_approx,
        "weather": weather,
        "actual_travel_time_minutes": travel_time,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Generating {NUM_ROWS} synthetic trip records...")

    rows = [generate_row(i + 1) for i in range(NUM_ROWS)]

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"✓ Saved to {OUTPUT_FILE}")

    # Quick stats
    times = [r["actual_travel_time_minutes"] for r in rows]
    print(f"  Mean travel time:   {sum(times)/len(times):.1f} min")
    print(f"  Min travel time:    {min(times):.1f} min")
    print(f"  Max travel time:    {max(times):.1f} min")
    print(f"  Std dev:            {(sum((t - sum(times)/len(times))**2 for t in times)/len(times))**0.5:.1f} min")

    rush_rows = [r for r in rows if is_rush_hour(r["departure_time"])]
    rush_times = [r["actual_travel_time_minutes"] for r in rush_rows]
    if rush_times:
        print(f"  Rush-hour mean:     {sum(rush_times)/len(rush_times):.1f} min ({len(rush_times)} trips)")

    rain_rows = [r for r in rows if r["weather"] == 2]
    rain_times = [r["actual_travel_time_minutes"] for r in rain_rows]
    if rain_times:
        print(f"  Rain mean:          {sum(rain_times)/len(rain_times):.1f} min ({len(rain_times)} trips)")


if __name__ == "__main__":
    main()
