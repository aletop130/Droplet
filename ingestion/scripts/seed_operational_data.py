from __future__ import annotations

import json
import os
import random
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")
ISTAT_PATH = ROOT / "data" / "processed" / "istat_frosinone.json"
RNG = random.Random(20260425)


def connect_supabase():
    password = os.getenv("SUPABASE_DB_PASSWORD")
    if password:
        return psycopg.connect(
            host=os.getenv("SUPABASE_DB_HOST", "aws-1-eu-central-1.pooler.supabase.com"),
            port=int(os.getenv("SUPABASE_DB_PORT", "5432")),
            dbname=os.getenv("SUPABASE_DB_NAME", "postgres"),
            user=os.getenv("SUPABASE_DB_USER", "postgres.cnqwlkkoikcymavbnnfu"),
            password=password,
            sslmode=os.getenv("SUPABASE_DB_SSLMODE", "require"),
            autocommit=True,
        )
    return psycopg.connect(os.environ["SUPABASE_DB_POOLER_URL"], autocommit=True)


def load_istat() -> dict:
    with ISTAT_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def fetch_ids(cur):
    cur.execute(
        """
        SELECT id, dma_id
        FROM (
          SELECT id, dma_id, row_number() OVER (PARTITION BY dma_id ORDER BY id) AS rn
          FROM pipe_segments
        ) ranked
        WHERE rn <= 14
        ORDER BY dma_id, rn
        """
    )
    segments = cur.fetchall()
    cur.execute("SELECT id, attrs->>'data_source', COALESCE((attrs->>'capacity_m3')::float, 0) FROM pipe_nodes WHERE node_type='tank' ORDER BY id LIMIT 12")
    tanks = cur.fetchall()
    cur.execute("SELECT id, name FROM dmas ORDER BY id")
    dmas = cur.fetchall()
    return segments, tanks, dmas


def reset_tables(cur):
    cur.execute("TRUNCATE TABLE control_recommendations RESTART IDENTITY CASCADE")
    cur.execute("TRUNCATE TABLE incidents RESTART IDENTITY CASCADE")
    cur.execute("TRUNCATE TABLE ai_audit_log RESTART IDENTITY CASCADE")
    cur.execute("DELETE FROM municipality_kpis")
    cur.execute("DELETE FROM tank_balance")
    cur.execute("DELETE FROM anomaly_scores")


def seed_kpis(cur, istat: dict):
    tav17 = istat["tav17_frosinone"]
    losses = tav17["acqua_immessa_migliaia_m3"] - tav17["acqua_erogata_migliaia_m3"]
    rows = [
        (
            "Provincia di Frosinone",
            2020,
            tav17["nrw_pct"],
            tav17["acqua_immessa_migliaia_m3"] * 1000,
            tav17["acqua_erogata_migliaia_m3"] * 1000,
            losses * 1000,
            5.8,
            7420000.0,
        ),
        (
            "Frosinone",
            2020,
            67.9,
            18800000,
            6030000,
            12770000,
            5.4,
            1310000.0,
        ),
        (
            "Ceccano",
            2020,
            71.2,
            12100000,
            3480000,
            8630000,
            6.2,
            950000.0,
        ),
        (
            "Cassino",
            2020,
            65.4,
            17300000,
            5980000,
            11320000,
            5.1,
            1440000.0,
        ),
    ]
    cur.executemany(
        """
        INSERT INTO municipality_kpis (
          comune, year, nrw_pct, volume_input_m3, volume_distributed_m3, losses_m3, ili, uarl_m3
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (comune, year) DO UPDATE
        SET nrw_pct = EXCLUDED.nrw_pct,
            volume_input_m3 = EXCLUDED.volume_input_m3,
            volume_distributed_m3 = EXCLUDED.volume_distributed_m3,
            losses_m3 = EXCLUDED.losses_m3,
            ili = EXCLUDED.ili,
            uarl_m3 = EXCLUDED.uarl_m3
        """,
        rows,
    )


def seed_anomaly_scores(cur, segments):
    now = datetime.now(timezone.utc)
    rows = []
    for index, (segment_id, dma_id) in enumerate(segments, start=1):
        dma_bias = (int(dma_id or 1) + index) % 3
        phi = 3 if index % 5 in {0, 1} else 2 if dma_bias != 0 else 1
        base = 0.22 + (phi * 0.17)
        rows.append(
            (
                segment_id,
                now - timedelta(minutes=index * 3),
                round(min(1.0, base + 0.03), 3),
                round(min(1.0, base + 0.01), 3),
                round(min(1.0, base + 0.02), 3),
                round(min(1.0, base + 0.08), 3),
                round(min(1.0, base + 0.05), 3),
                phi,
                round(0.61 + phi * 0.08, 2),
                f"Seeded Step 1 PHI for segment {segment_id} in DMA {dma_id}.",
            )
        )
    cur.executemany(
        """
        INSERT INTO anomaly_scores (
          segment_id, ts, subsidence, ndvi, thermal, hydraulic, tank_signal, phi, phi_confidence, explanation
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        rows,
    )


def seed_incidents(cur, segments, tanks, dmas):
    dma_names = {dma_id: name for dma_id, name in dmas}
    now = datetime.now(timezone.utc)
    incident_ids = []
    top_segments = segments[:36]
    for idx, (segment_id, dma_id) in enumerate(top_segments, start=1):
        severity = 3 if idx % 6 in {0, 1} else 2 if idx % 3 != 0 else 1
        title = f"Perdita probabile FD-{segment_id} DMA-{dma_id}"
        cur.execute(
            """
            INSERT INTO incidents (
              created_at, updated_at, entity_type, entity_id, severity, detector_events, tags, title, pre_explanation, status, assigned_to
            ) VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                now - timedelta(hours=idx),
                now - timedelta(minutes=idx * 7),
                "segment",
                segment_id,
                severity,
                json.dumps([{"detector": "phi_seed", "score": 0.4 + severity * 0.15}]),
                [dma_names.get(dma_id, f"DMA-{dma_id}"), "seed_step_1"],
                title,
                f"Segmento {segment_id} in {dma_names.get(dma_id, f'DMA-{dma_id}')} con PHI elevato e priorità operativa.",
                "open",
                "operator",
            )
        )
        incident_ids.append(cur.fetchone()[0])
    return incident_ids


def seed_control_recs(cur, incident_ids, segments):
    rows = []
    for idx, incident_id in enumerate(incident_ids[:3], start=1):
        segment_id = segments[idx - 1][0]
        rows.append(
            (
                incident_id,
                "segment",
                segment_id,
                "pressure_setpoint_bar",
                4.2,
                3.8 - idx * 0.1,
                f"Ridurre il setpoint nel digital twin sul corridoio del segmento {segment_id} per abbassare il carico transitorio.",
                json.dumps({"expected_nrw_reduction_pct": 0.7 + idx * 0.2, "pressure_delta_bar": -0.2 - idx * 0.05}),
                0.68 + idx * 0.05,
                ["pressure_transient", "human_approval_required"],
                "proposed",
            )
        )
    cur.executemany(
        """
        INSERT INTO control_recommendations (
          incident_id, entity_type, entity_id, parameter, current_value, proposed_value, rationale,
          expected_impact, confidence, risk_flags, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)
        """,
        rows,
    )


def seed_audit(cur, segments, tanks):
    now = datetime.now(timezone.utc)
    rows = []
    for idx in range(5):
        entity_type = "tank" if idx % 2 else "segment"
        entity_id = tanks[idx % len(tanks)][0] if entity_type == "tank" else segments[idx % len(segments)][0]
        rows.append(
            (
                now - timedelta(minutes=idx * 9),
                "gpt-oss-120b",
                "seed_bootstrap",
                entity_type,
                entity_id,
                json.dumps({"seed": True, "entity_type": entity_type, "entity_id": entity_id}),
                f"Bootstrap audit trail row for {entity_type} {entity_id}.",
                0.62 + idx * 0.04,
                json.dumps([{"tool": "seed_operational_data", "index": idx}]),
                ["seed-step-1"],
                json.dumps({"path": [entity_type, entity_id]}),
                json.dumps({"stage": "bootstrap"}),
                None,
                "operator",
                None,
                1200 + idx * 120,
                json.dumps({"prompt_tokens": 220 + idx * 10, "completion_tokens": 140 + idx * 8}),
            )
        )
    cur.executemany(
        """
        INSERT INTO ai_audit_log (
          ts, model, purpose, entity_type, entity_id, request_payload, response_text, confidence,
          tool_calls, retrieved_doc_ids, graph_path, explanation_chain, operator_action, operator_id,
          operator_note, latency_ms, token_usage
        ) VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s::jsonb, %s, %s::jsonb, %s::jsonb, %s, %s, %s, %s, %s::jsonb)
        """,
        rows,
    )


def seed_tank_balance(cur, tanks):
    today = date.today()
    selected = tanks[:3]
    rows = []
    for tank_id, data_source, capacity_m3 in selected:
        capacity = capacity_m3 or 1200.0
        for offset in range(10):
            day = today - timedelta(days=offset)
            inflow = round(capacity * (0.30 + RNG.random() * 0.08), 2)
            outflow = round(capacity * (0.42 + RNG.random() * 0.09), 2)
            demand = round(capacity * (0.36 + RNG.random() * 0.08), 2)
            delta = round(inflow - outflow, 2)
            residual = round(inflow - outflow - demand + RNG.uniform(-12, 12), 2)
            rows.append(
                (
                    tank_id,
                    day,
                    inflow,
                    outflow,
                    demand,
                    delta,
                    residual,
                    round((residual / max(inflow, 1.0)) * 100, 2),
                    "watch" if abs(residual) > 50 else "normal",
                )
            )
    cur.executemany(
        """
        INSERT INTO tank_balance (
          tank_id, day, inflow_m3, outflow_m3, demand_m3, delta_volume_m3, residual_m3, residual_pct, flag
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        rows,
    )


def main():
    istat = load_istat()
    with connect_supabase() as conn:
        with conn.cursor() as cur:
            reset_tables(cur)
            segments, tanks, dmas = fetch_ids(cur)
            seed_kpis(cur, istat)
            seed_anomaly_scores(cur, segments)
            incident_ids = seed_incidents(cur, segments, tanks, dmas)
            seed_control_recs(cur, incident_ids, segments)
            seed_audit(cur, segments, tanks)
            seed_tank_balance(cur, tanks)

            cur.execute("SELECT COUNT(*) FROM municipality_kpis")
            municipality_kpis = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM anomaly_scores")
            anomaly_scores = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM incidents")
            incidents = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM control_recommendations")
            control_recommendations = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM ai_audit_log")
            ai_audit_log = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM tank_balance")
            tank_balance = cur.fetchone()[0]
    print(
        {
            "municipality_kpis": municipality_kpis,
            "anomaly_scores": anomaly_scores,
            "incidents": incidents,
            "control_recommendations": control_recommendations,
            "ai_audit_log": ai_audit_log,
            "tank_balance": tank_balance,
        }
    )


if __name__ == "__main__":
    main()
