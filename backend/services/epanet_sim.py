from __future__ import annotations

import asyncio
import json
import math
import random
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone

import wntr

from db.supabase import get_connection
from services.alert_stream import alert_stream
from services.detectors import (
    IsolationForestPool,
    bounded,
    classify_mass_balance_flag,
    cyclical_hour_value,
    mass_balance_detector,
    safe_ratio,
    zscore_detector,
)
from services.phi_engine import classify_phi
from services.rule_engine import upsert_incidents


@dataclass
class SegmentRef:
    id: int
    dma_id: int
    from_node: int
    to_node: int
    length_m: float
    diameter_mm: int


@dataclass
class TankRef:
    id: int
    dma_id: int
    name: str
    capacity_m3: float
    max_level_m: float
    min_level_m: float
    level_m: float


class EpanetSimService:
    def __init__(self):
        self._task: asyncio.Task | None = None
        self._running = False
        self._tick_seconds = 5
        self._tank_tick_seconds = 30
        self._segment_batch_size = 220
        self._started_at: datetime | None = None
        self._tick_count = 0
        self._wn = None
        self._segments: list[SegmentRef] = []
        self._tanks: list[TankRef] = []
        self._prev_tank_level: dict[int, float] = {}
        self._dldt_history: dict[int, deque[float]] = defaultdict(lambda: deque(maxlen=14 * 24 * 2))
        self._iforest = IsolationForestPool(contamination=0.02)
        self._tank_signal_by_dma: dict[int, float] = defaultdict(float)

    async def start(self):
        if self._running:
            return
        self._bootstrap_network()
        self._running = True
        self._started_at = datetime.now(timezone.utc)
        self._task = asyncio.create_task(self._run_loop(), name="epanet-sim")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def status(self) -> dict:
        now = datetime.now(timezone.utc)
        uptime_s = int((now - self._started_at).total_seconds()) if self._started_at else 0
        return {
            "status": "running" if self._running else "stopped",
            "tick_seconds": self._tick_seconds,
            "tank_tick_seconds": self._tank_tick_seconds,
            "segments_loaded": len(self._segments),
            "tanks_loaded": len(self._tanks),
            "tick_count": self._tick_count,
            "uptime_s": uptime_s,
        }

    def _bootstrap_network(self):
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, dma_id, from_node, to_node, length_m, COALESCE(diameter_mm, 200)
                    FROM pipe_segments
                    ORDER BY id
                    """
                )
                self._segments = [
                    SegmentRef(
                        id=row[0],
                        dma_id=row[1],
                        from_node=row[2],
                        to_node=row[3],
                        length_m=float(row[4]),
                        diameter_mm=int(row[5]),
                    )
                    for row in cur.fetchall()
                ]
                cur.execute(
                    """
                    SELECT n.id, d.id AS dma_id, COALESCE(n.name, 'TK-' || n.id::text),
                           COALESCE((n.attrs->>'capacity_m3')::float, 1200.0),
                           COALESCE((n.attrs->>'max_level_m')::float, 6.0),
                           COALESCE((n.attrs->>'min_level_m')::float, 1.2)
                    FROM pipe_nodes n
                    LEFT JOIN dmas d ON ST_Intersects(n.geom, d.geom)
                    WHERE n.node_type = 'tank'
                    ORDER BY n.id
                    """
                )
                self._tanks = [
                    TankRef(
                        id=row[0],
                        dma_id=int(row[1] or 1),
                        name=row[2],
                        capacity_m3=float(row[3]),
                        max_level_m=float(row[4]),
                        min_level_m=float(row[5]),
                        level_m=max(
                            float(row[5]),
                            min(float(row[4]), float(row[4]) * (0.28 + (int(row[0]) % 8) * 0.035)),
                        ),
                    )
                    for row in cur.fetchall()
                ]

        # Build an in-memory EPANET model artifact from topology.
        wn = wntr.network.WaterNetworkModel()
        node_ids = set()
        for segment in self._segments:
            node_ids.add(segment.from_node)
            node_ids.add(segment.to_node)
        for node_id in node_ids:
            wn.add_junction(f"J{node_id}", base_demand=0.001, elevation=0.0)
        for tank in self._tanks:
            wn.add_tank(
                f"T{tank.id}",
                elevation=0.0,
                init_level=tank.level_m,
                min_level=tank.min_level_m,
                max_level=tank.max_level_m,
                diameter=max(6.0, math.sqrt(max(tank.capacity_m3, 100.0) / (math.pi * max(tank.max_level_m, 1.0))) * 2.0),
            )
        for segment in self._segments:
            wn.add_pipe(
                f"P{segment.id}",
                f"J{segment.from_node}",
                f"J{segment.to_node}",
                length=max(10.0, segment.length_m),
                diameter=max(0.06, segment.diameter_mm / 1000.0),
                roughness=110.0,
            )
        self._wn = wn

    async def _run_loop(self):
        while self._running:
            tick_started = time.perf_counter()
            self._tick_count += 1
            tick_ts = datetime.now(timezone.utc)
            segment_state = self._write_segment_observations(tick_ts)
            segment_incident_events = self._write_anomaly_scores(tick_ts, segment_state)
            await alert_stream.publish("epanet_tick", self._dma_pressures_payload(tick_ts))
            tank_incident_events: list[dict] = []

            if self._tick_count % (self._tank_tick_seconds // self._tick_seconds) == 0:
                tank_payload, tank_incident_events = self._write_tank_telemetry(tick_ts)
                for item in tank_payload:
                    await alert_stream.publish("tank_state", item)
            if (self._tick_count % 3) == 0 and (segment_incident_events or tank_incident_events):
                incident_updates = upsert_incidents(segment_incident_events + tank_incident_events)
                for incident in incident_updates:
                    event_type = incident.pop("event_type")
                    await alert_stream.publish(event_type, incident)

            elapsed = time.perf_counter() - tick_started
            await asyncio.sleep(max(0.2, self._tick_seconds - elapsed))

    def _write_segment_observations(self, ts: datetime) -> list[dict]:
        # Keep tick cost bounded for HF CPU and DB latency budgets.
        segments = self._segments[: self._segment_batch_size]
        if not segments:
            return []
        sec_of_day = ts.hour * 3600 + ts.minute * 60 + ts.second
        rows = []
        state = []
        for segment in segments:
            diurnal = 1.0 + 0.22 * math.sin((sec_of_day / 86400.0) * math.tau)
            base_flow = max(3.5, (segment.diameter_mm / 12.0) * diurnal)
            flow_lps = max(1.0, base_flow + random.uniform(-1.8, 1.8))
            pressure_bar = max(1.5, 5.1 - (segment.length_m / 3600.0) + random.uniform(-0.18, 0.18))
            rows.append((ts, segment.id, segment.dma_id, "flow_lps", flow_lps, 0.84, "epanet_sim", "{}"))
            rows.append((ts, segment.id, segment.dma_id, "pressure_bar", pressure_bar, 0.82, "epanet_sim", "{}"))
            state.append(
                {
                    "segment_id": segment.id,
                    "dma_id": segment.dma_id,
                    "flow_lps": flow_lps,
                    "pressure_bar": pressure_bar,
                }
            )
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO observations (ts, segment_id, dma_id, metric, value, confidence, source, provenance)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    rows,
                )
        return state

    def _write_tank_telemetry(self, ts: datetime) -> tuple[list[dict], list[dict]]:
        if not self._tanks:
            return [], []
        sec_of_day = ts.hour * 3600 + ts.minute * 60 + ts.second
        state_rows = []
        obs_rows = []
        anomaly_rows = []
        balance_rows = []
        payload = []
        incident_events = []
        tank_signal_per_dma: dict[int, list[float]] = defaultdict(list)

        for tank in self._tanks:
            wave = math.sin((sec_of_day / 86400.0) * math.tau + (tank.id % 7) * 0.4)
            inflow_lps = max(5.0, 16.0 + wave * 4.2 + random.uniform(-1.3, 1.0))
            outflow_lps = max(8.0, 24.0 - wave * 3.2 + random.uniform(-1.0, 1.8))
            delta_m = ((inflow_lps - outflow_lps) * self._tank_tick_seconds) / max(70.0, tank.capacity_m3)
            tank.level_m = min(tank.max_level_m, max(tank.min_level_m, tank.level_m + delta_m))
            volume_m3 = max(0.0, (tank.level_m / max(tank.max_level_m, 0.1)) * tank.capacity_m3)
            pump_on = inflow_lps > outflow_lps
            pump_speed_pct = 55.0 + abs(wave) * 40.0
            downstream_pressure = max(1.4, 3.2 + wave * 0.4 + random.uniform(-0.08, 0.08))
            temp_c = 15.0 + 8.5 * math.sin((sec_of_day / 86400.0) * math.tau)
            turbidity = max(0.1, 0.35 + random.uniform(-0.08, 0.08))
            prev_level = self._prev_tank_level.get(tank.id, tank.level_m)
            delta_volume_m3 = ((tank.level_m - prev_level) / max(tank.max_level_m, 0.1)) * tank.capacity_m3
            demand_m3 = outflow_lps * self._tank_tick_seconds / 1000.0
            inflow_m3 = inflow_lps * self._tank_tick_seconds / 1000.0
            outflow_m3 = outflow_lps * self._tank_tick_seconds / 1000.0
            residual_m3 = delta_volume_m3 - (inflow_m3 - outflow_m3 - demand_m3)
            residual_pct = safe_ratio(residual_m3, max(0.001, inflow_m3)) * 100.0
            mass = mass_balance_detector(residual_pct)
            dldt = (tank.level_m - prev_level) / max(1.0, self._tank_tick_seconds / 60.0)
            baseline = list(self._dldt_history[tank.id])
            zscore = zscore_detector(dldt, baseline)
            self._dldt_history[tank.id].append(dldt)
            hour_sin, hour_cos = cyclical_hour_value(ts.hour)
            iforest_features = [
                tank.level_m,
                dldt,
                inflow_lps,
                outflow_lps,
                safe_ratio(inflow_lps, outflow_lps),
                downstream_pressure,
                pump_speed_pct,
                temp_c,
                hour_sin,
                hour_cos,
            ]
            iforest = self._iforest.score(tank.id, iforest_features)
            detector_events = [mass, zscore, iforest]
            tank_severity = max(event["severity"] for event in detector_events)
            tank_signal_per_dma[tank.dma_id].append(min(1.0, tank_severity / 3.0))
            if tank_severity >= 2:
                incident_events.append(
                    {
                        "entity_type": "tank",
                        "entity_id": tank.id,
                        "severity": tank_severity,
                        "detector": "correlated_tank",
                    }
                )
            flag = classify_mass_balance_flag(residual_pct, inflow_lps, outflow_lps, delta_volume_m3)
            balance_rows.append(
                (
                    tank.id,
                    ts.date(),
                    inflow_m3,
                    outflow_m3,
                    demand_m3,
                    delta_volume_m3,
                    residual_m3,
                    residual_pct,
                    flag,
                )
            )
            for event in detector_events:
                if event["severity"] <= 0:
                    continue
                anomaly_rows.append(
                    (
                        tank.id,
                        ts,
                        event["detector"],
                        float(event["score"]),
                        int(event["severity"]),
                        json.dumps(
                            {
                                "level_m": tank.level_m,
                                "dldt": dldt,
                                "inflow_lps": inflow_lps,
                                "outflow_lps": outflow_lps,
                                "downstream_pressure_bar": downstream_pressure,
                                "residual_pct": residual_pct,
                            }
                        ),
                        f"{event['detector']} anomaly on {tank.name}",
                        [],
                    )
                )
            self._prev_tank_level[tank.id] = tank.level_m

            state_rows.append(
                (
                    tank.id,
                    ts,
                    tank.level_m,
                    volume_m3,
                    inflow_lps,
                    outflow_lps,
                    pump_on,
                    pump_speed_pct,
                    "{}",
                    downstream_pressure,
                    temp_c,
                    turbidity,
                )
            )
            obs_rows.extend(
                [
                    (ts, tank.id, tank.dma_id, "tank_level", tank.level_m, 0.83, "telecontrol_sim", "{}"),
                    (ts, tank.id, tank.dma_id, "tank_inflow", inflow_lps, 0.81, "telecontrol_sim", "{}"),
                    (ts, tank.id, tank.dma_id, "tank_outflow", outflow_lps, 0.81, "telecontrol_sim", "{}"),
                ]
            )
            payload.append(
                {
                    "tank_id": tank.id,
                    "level_m": round(tank.level_m, 3),
                    "inflow_lps": round(inflow_lps, 3),
                    "outflow_lps": round(outflow_lps, 3),
                    "ts": ts.isoformat(),
                }
            )

        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO tank_state (
                      tank_id, ts, level_m, volume_m3, inflow_lps, outflow_lps, pump_on,
                      pump_speed_pct, valve_state, downstream_pressure_bar, temp_c, turbidity_ntu
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)
                    ON CONFLICT (tank_id, ts) DO UPDATE
                    SET level_m = EXCLUDED.level_m,
                        volume_m3 = EXCLUDED.volume_m3,
                        inflow_lps = EXCLUDED.inflow_lps,
                        outflow_lps = EXCLUDED.outflow_lps,
                        pump_on = EXCLUDED.pump_on,
                        pump_speed_pct = EXCLUDED.pump_speed_pct,
                        valve_state = EXCLUDED.valve_state,
                        downstream_pressure_bar = EXCLUDED.downstream_pressure_bar,
                        temp_c = EXCLUDED.temp_c,
                        turbidity_ntu = EXCLUDED.turbidity_ntu
                    """,
                    state_rows,
                )
                cur.executemany(
                    """
                    INSERT INTO observations (ts, node_id, dma_id, metric, value, confidence, source, provenance)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    obs_rows,
                )
                if anomaly_rows:
                    cur.executemany(
                        """
                        INSERT INTO tank_anomalies (tank_id, ts, detector, score, severity, features, explanation, linked_segments)
                        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                        """,
                        anomaly_rows,
                    )
                if balance_rows:
                    cur.executemany(
                        """
                        INSERT INTO tank_balance (
                          tank_id, day, inflow_m3, outflow_m3, demand_m3, delta_volume_m3, residual_m3, residual_pct, flag
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (tank_id, day) DO UPDATE
                        SET inflow_m3 = tank_balance.inflow_m3 + EXCLUDED.inflow_m3,
                            outflow_m3 = tank_balance.outflow_m3 + EXCLUDED.outflow_m3,
                            demand_m3 = tank_balance.demand_m3 + EXCLUDED.demand_m3,
                            delta_volume_m3 = tank_balance.delta_volume_m3 + EXCLUDED.delta_volume_m3,
                            residual_m3 = tank_balance.residual_m3 + EXCLUDED.residual_m3,
                            residual_pct = EXCLUDED.residual_pct,
                            flag = EXCLUDED.flag
                        """,
                        balance_rows,
                    )
        for dma_id, scores in tank_signal_per_dma.items():
            self._tank_signal_by_dma[dma_id] = float(sum(scores) / max(1, len(scores)))
        return payload, incident_events

    def _write_anomaly_scores(self, ts: datetime, segment_state: list[dict]) -> list[dict]:
        if not segment_state:
            return []
        rows = []
        incident_candidates = []
        for item in segment_state:
            segment_id = int(item["segment_id"])
            dma_id = int(item["dma_id"])
            # Deterministic synthetic geospatial residuals until full raster stack is wired.
            subsidence = bounded(0.2 + ((segment_id * 17) % 55) / 100.0)
            ndvi = bounded(0.18 + ((segment_id * 23) % 52) / 100.0)
            thermal = bounded(0.22 + ((segment_id * 29) % 48) / 100.0)
            hydraulic = bounded(abs(item["flow_lps"] - 18.0) / 35.0 + abs(item["pressure_bar"] - 3.2) / 4.0)
            tank_signal = bounded(self._tank_signal_by_dma.get(dma_id, 0.0))
            phi = classify_phi(subsidence, ndvi, thermal, hydraulic, tank_signal)
            confidence = bounded(0.62 + hydraulic * 0.2 + tank_signal * 0.12)
            rows.append(
                (
                    segment_id,
                    ts,
                    subsidence,
                    ndvi,
                    thermal,
                    hydraulic,
                    tank_signal,
                    int(phi),
                    confidence,
                    "Synthetic L0 fusion from EPANET + tank detectors",
                )
            )
            if phi >= 2:
                incident_candidates.append(
                    {
                        "entity_type": "segment",
                        "entity_id": segment_id,
                        "severity": int(phi),
                        "detector": "phi_fusion",
                        "priority": float(hydraulic + tank_signal),
                    }
                )
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    INSERT INTO anomaly_scores (
                      segment_id, ts, subsidence, ndvi, thermal, hydraulic, tank_signal, phi, phi_confidence, explanation
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (segment_id, ts) DO UPDATE
                    SET subsidence = EXCLUDED.subsidence,
                        ndvi = EXCLUDED.ndvi,
                        thermal = EXCLUDED.thermal,
                        hydraulic = EXCLUDED.hydraulic,
                        tank_signal = EXCLUDED.tank_signal,
                        phi = EXCLUDED.phi,
                        phi_confidence = EXCLUDED.phi_confidence,
                        explanation = EXCLUDED.explanation
                    """,
                    rows,
                )
        incident_candidates.sort(key=lambda item: item["priority"], reverse=True)
        return [
            {key: value for key, value in item.items() if key != "priority"}
            for item in incident_candidates[:6]
        ]

    def _dma_pressures_payload(self, ts: datetime) -> dict:
        snapshot: dict[str, float] = {}
        per_dma: dict[int, list[float]] = {}
        sec_of_day = ts.hour * 3600 + ts.minute * 60 + ts.second
        for segment in self._segments[: self._segment_batch_size]:
            value = max(1.4, 5.0 - (segment.length_m / 4000.0) + 0.2 * math.sin((sec_of_day / 86400.0) * math.tau))
            per_dma.setdefault(segment.dma_id, []).append(value)
        for dma_id, values in per_dma.items():
            snapshot[str(dma_id)] = round(sum(values) / max(1, len(values)), 3)
        return {"ts": ts.isoformat(), "dma_pressures": snapshot}


sim_service = EpanetSimService()


def simulation_status() -> dict:
    return sim_service.status()
