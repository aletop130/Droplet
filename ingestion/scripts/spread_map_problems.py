from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from seed_operational_data import connect_supabase


TAG = "distributed_map_seed"


def main() -> None:
    now = datetime.now(timezone.utc)
    with connect_supabase() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, dma_id, dma_name
                FROM (
                  SELECT
                    ps.id,
                    ps.dma_id,
                    d.name AS dma_name,
                    row_number() OVER (PARTITION BY ps.dma_id ORDER BY ps.id) AS rn
                  FROM pipe_segments ps
                  LEFT JOIN dmas d ON d.id = ps.dma_id
                  WHERE ps.dma_id IS NOT NULL
                ) ranked
                WHERE rn IN (1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24)
                ORDER BY dma_id, rn
                """
            )
            segments = cur.fetchall()

            cur.execute("DELETE FROM incidents WHERE tags @> %s", ([TAG],))

            anomaly_rows = []
            incident_rows = []
            for index, (segment_id, dma_id, dma_name) in enumerate(segments, start=1):
                severity = 3 if index % 5 in {0, 1, 2} else 2 if index % 3 != 0 else 1
                phi = severity
                base = 0.24 + phi * 0.18
                anomaly_rows.append(
                    (
                        segment_id,
                        now - timedelta(minutes=index),
                        round(min(1.0, base + 0.04), 3),
                        round(min(1.0, base + ((index % 5) * 0.012)), 3),
                        round(min(1.0, base + 0.03), 3),
                        round(min(1.0, base + 0.09), 3),
                        round(min(1.0, base + 0.06), 3),
                        phi,
                        round(0.68 + phi * 0.07, 2),
                        f"Distributed map problem seed for segment {segment_id} in {dma_name or f'DMA-{dma_id}'}."
                    )
                )
                incident_rows.append(
                    (
                        now - timedelta(hours=index % 12, minutes=index * 2),
                        now - timedelta(minutes=index),
                        "segment",
                        segment_id,
                        severity,
                        json.dumps([
                            {"detector": "distributed_phi_seed", "score": round(0.55 + severity * 0.12, 2)},
                            {"detector": "hydraulic_delta", "score": round(0.48 + (index % 4) * 0.1, 2)}
                        ]),
                        [dma_name or f"DMA-{dma_id}", TAG, "map_problem"],
                        f"Leak cluster candidate FD-{segment_id} {dma_name or f'DMA-{dma_id}'}",
                        f"Distributed anomaly on segment {segment_id}: hydraulic delta, thermal signal and PHI {phi} outside baseline.",
                        "open",
                        "operator",
                    )
                )

            cur.executemany(
                """
                INSERT INTO anomaly_scores (
                  segment_id, ts, subsidence, ndvi, thermal, hydraulic, tank_signal, phi, phi_confidence, explanation
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                anomaly_rows,
            )
            cur.executemany(
                """
                INSERT INTO incidents (
                  created_at, updated_at, entity_type, entity_id, severity, detector_events, tags,
                  title, pre_explanation, status, assigned_to
                ) VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s)
                """,
                incident_rows,
            )

            print(json.dumps({"segments_updated": len(anomaly_rows), "incidents_inserted": len(incident_rows)}))


if __name__ == "__main__":
    main()
