"""
ETA Model Training Script.

Trains two regression models on historical_trips.csv:
  1. GradientBoostingRegressor (primary)
  2. LinearRegression (baseline)

Evaluates both with RMSE and MAE on a 20 % test split, prints a comparison
table, saves the best model as eta_model.pkl, and generates a feature
importance bar chart as feature_importance.png.

Usage:
    python train_eta_model.py
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use("Agg")  # non-interactive backend for server environments
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, mean_absolute_error

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(__file__)
DATA_FILE = os.path.join(BASE_DIR, "historical_trips.csv")
MODEL_FILE = os.path.join(BASE_DIR, "eta_model.pkl")
IMPORTANCE_PLOT = os.path.join(BASE_DIR, "feature_importance.png")

# ---------------------------------------------------------------------------
# Feature / target columns
# ---------------------------------------------------------------------------

FEATURE_COLS = [
    "departure_time",
    "day_of_week",
    "traffic_level",
    "avg_signal_strength",
    "weather",
    "num_passengers_approx",
]
TARGET_COL = "actual_travel_time_minutes"


def main():
    # ------------------------------------------------------------------
    # 1. Load data
    # ------------------------------------------------------------------
    if not os.path.exists(DATA_FILE):
        print(f"ERROR: {DATA_FILE} not found.  Run generate_historical_data.py first.")
        sys.exit(1)

    df = pd.read_csv(DATA_FILE)
    print(f"Loaded {len(df)} records from {DATA_FILE}")
    print(f"Columns: {list(df.columns)}\n")

    X = df[FEATURE_COLS].values
    y = df[TARGET_COL].values

    # ------------------------------------------------------------------
    # 2. Train / test split (80/20)
    # ------------------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )
    print(f"Train: {len(X_train)}  |  Test: {len(X_test)}\n")

    # ------------------------------------------------------------------
    # 3. Train models
    # ------------------------------------------------------------------
    # Gradient Boosting (primary)
    gb_model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        min_samples_split=5,
        min_samples_leaf=3,
        subsample=0.9,
        random_state=42,
    )
    gb_model.fit(X_train, y_train)
    gb_pred = gb_model.predict(X_test)

    # Linear Regression (baseline)
    lr_model = LinearRegression()
    lr_model.fit(X_train, y_train)
    lr_pred = lr_model.predict(X_test)

    # ------------------------------------------------------------------
    # 4. Evaluate
    # ------------------------------------------------------------------
    gb_rmse = np.sqrt(mean_squared_error(y_test, gb_pred))
    gb_mae  = mean_absolute_error(y_test, gb_pred)

    lr_rmse = np.sqrt(mean_squared_error(y_test, lr_pred))
    lr_mae  = mean_absolute_error(y_test, lr_pred)

    print("=" * 55)
    print(f"{'Model':<28} {'RMSE':>10} {'MAE':>10}")
    print("-" * 55)
    print(f"{'GradientBoostingRegressor':<28} {gb_rmse:>10.3f} {gb_mae:>10.3f}")
    print(f"{'LinearRegression (baseline)':<28} {lr_rmse:>10.3f} {lr_mae:>10.3f}")
    print("=" * 55)

    # Determine the winner
    if gb_rmse <= lr_rmse:
        best_model = gb_model
        best_name = "GradientBoostingRegressor"
    else:
        best_model = lr_model
        best_name = "LinearRegression"

    print(f"\n✓ Best model: {best_name}  (RMSE={min(gb_rmse, lr_rmse):.3f})")

    # ------------------------------------------------------------------
    # 5. Save best model
    # ------------------------------------------------------------------
    joblib.dump(best_model, MODEL_FILE)
    print(f"✓ Model saved to {MODEL_FILE}")

    # ------------------------------------------------------------------
    # 6. Feature importance plot (only for tree-based models)
    # ------------------------------------------------------------------
    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
        sorted_idx = np.argsort(importances)[::-1]

        fig, ax = plt.subplots(figsize=(8, 5))

        # Dark-themed plot to match the frontend aesthetic
        fig.patch.set_facecolor("#0f1629")
        ax.set_facecolor("#161d35")

        colors = ["#06d6a0", "#118ab2", "#ff9f1c", "#7b2ff7", "#ef476f", "#ffd166"]
        bars = ax.barh(
            [FEATURE_COLS[i] for i in sorted_idx],
            importances[sorted_idx],
            color=[colors[i % len(colors)] for i in range(len(sorted_idx))],
            edgecolor="#2a3456",
            height=0.6,
        )

        ax.set_xlabel("Importance", color="#a0aec0", fontsize=11)
        ax.set_title("Feature Importance — ETA Prediction Model",
                      color="#e2e8f0", fontsize=13, fontweight="bold", pad=12)
        ax.tick_params(colors="#a0aec0", labelsize=10)
        for spine in ax.spines.values():
            spine.set_color("#2a3456")
        ax.invert_yaxis()

        plt.tight_layout()
        plt.savefig(IMPORTANCE_PLOT, dpi=150, facecolor=fig.get_facecolor())
        plt.close()
        print(f"✓ Feature importance plot saved to {IMPORTANCE_PLOT}")
    else:
        print("⚠ Best model has no feature_importances_; skipping plot.")

    print("\nDone. Model is ready for the /api/predict-eta endpoint.")


if __name__ == "__main__":
    main()
