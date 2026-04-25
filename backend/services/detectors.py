from __future__ import annotations

import math
from collections import defaultdict, deque

import numpy as np

try:
    from sklearn.ensemble import IsolationForest
except Exception:  # pragma: no cover - runtime fallback when sklearn missing
    IsolationForest = None


def mass_balance_detector(residual_pct: float) -> dict:
    abs_pct = abs(residual_pct)
    severity = 3 if abs_pct >= 8 else 2 if abs_pct >= 5 else 1 if abs_pct >= 3 else 0
    return {"detector": "mass_balance", "score": min(1.0, abs_pct / 10.0), "severity": severity}


def zscore_detector(value: float, baseline_values: list[float]) -> dict:
    if len(baseline_values) < 8:
        return {"detector": "zscore", "score": 0.0, "severity": 0, "z": 0.0}
    mu = float(np.mean(baseline_values))
    sigma = float(np.std(baseline_values))
    z = 0.0 if sigma < 1e-8 else (value - mu) / sigma
    abs_z = abs(z)
    severity = 3 if abs_z >= 4.0 else 2 if abs_z >= 3.0 else 1 if abs_z >= 2.2 else 0
    return {"detector": "zscore", "score": min(1.0, abs_z / 4.0), "severity": severity, "z": z}


class IsolationForestPool:
    def __init__(self, contamination: float = 0.02):
        self._contamination = contamination
        self._history: dict[int, deque[list[float]]] = defaultdict(lambda: deque(maxlen=256))

    def score(self, tank_id: int, features: list[float]) -> dict:
        hist = self._history[tank_id]
        hist.append(features)
        if len(hist) < 24:
            return {"detector": "iforest", "score": 0.0, "severity": 0}

        if IsolationForest is None:
            arr = np.array(hist, dtype=float)
            mu = arr.mean(axis=0)
            sigma = arr.std(axis=0) + 1e-6
            z = np.abs((np.array(features) - mu) / sigma)
            pseudo = float(np.clip(z.mean() / 4.0, 0.0, 1.0))
            severity = 3 if pseudo >= 0.85 else 2 if pseudo >= 0.65 else 1 if pseudo >= 0.45 else 0
            return {"detector": "iforest", "score": pseudo, "severity": severity}

        model = IsolationForest(
            contamination=self._contamination,
            random_state=42,
            n_estimators=80,
            max_samples=min(128, len(hist)),
        )
        arr = np.array(hist, dtype=float)
        model.fit(arr)
        decision = float(model.decision_function([features])[0])
        raw = float(np.clip((-decision + 0.25) / 0.8, 0.0, 1.0))
        severity = 3 if raw >= 0.85 else 2 if raw >= 0.65 else 1 if raw >= 0.45 else 0
        return {"detector": "iforest", "score": raw, "severity": severity}


def classify_mass_balance_flag(residual_pct: float, inflow_lps: float, outflow_lps: float, delta_volume_m3: float) -> str:
    if abs(residual_pct) > 5.0:
        return "tank_leak"
    if inflow_lps < outflow_lps and delta_volume_m3 <= 0.0:
        return "upstream_loss"
    if delta_volume_m3 < 0.0 and outflow_lps > 8.0:
        return "downstream_loss"
    return "normal"


def safe_ratio(num: float, den: float) -> float:
    if abs(den) < 1e-8:
        return 0.0
    return num / den


def bounded(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def cyclical_hour_value(hour: int) -> tuple[float, float]:
    angle = (hour / 24.0) * math.tau
    return math.sin(angle), math.cos(angle)
