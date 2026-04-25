from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from db.supabase import get_connection


def consolidate_incident(events: list[dict]) -> dict:
    severity = max((int(event.get("severity", 0)) for event in events), default=0)
    detector_count = len({event.get("detector") for event in events if event.get("detector")})
    correlation_bonus = 1 if detector_count >= 2 else 0
    final_severity = min(3, severity + correlation_bonus)
    return {"severity": final_severity, "events": events, "status": "open"}


def upsert_incidents(events: list[dict]) -> list[dict[str, Any]]:
    if not events:
        return []
    grouped: dict[tuple[str, int], list[dict]] = defaultdict(list)
    for event in events:
        grouped[(event["entity_type"], int(event["entity_id"]))].append(event)

    outputs: list[dict[str, Any]] = []
    with get_connection() as conn:
        with conn.cursor() as cur:
            for (entity_type, entity_id), group in grouped.items():
                consolidated = consolidate_incident(group)
                now = datetime.now(timezone.utc)
                dedup_since = now - timedelta(minutes=15)
                cur.execute(
                    """
                    SELECT id, severity, status
                    FROM incidents
                    WHERE entity_type = %s
                      AND entity_id = %s
                      AND status IN ('open', 'in_progress')
                      AND updated_at >= %s
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    (entity_type, entity_id, dedup_since),
                )
                existing = cur.fetchone()
                if existing:
                    incident_id = int(existing[0])
                    merged_severity = max(int(existing[1]), int(consolidated["severity"]))
                    cur.execute(
                        """
                        UPDATE incidents
                        SET updated_at = NOW(),
                            severity = %s,
                            detector_events = %s::jsonb,
                            tags = %s::text[],
                            pre_explanation = %s
                        WHERE id = %s
                        RETURNING id, severity, status
                        """,
                        (
                            merged_severity,
                            json.dumps(group),
                            [f"detector:{item.get('detector', 'unknown')}" for item in group],
                            f"Correlated {len(group)} detector events in 15-minute window.",
                            incident_id,
                        ),
                    )
                    row = cur.fetchone()
                    outputs.append(
                        {
                            "event_type": "incident_updated",
                            "incident_id": int(row[0]),
                            "severity": int(row[1]),
                            "status": row[2],
                            "entity_type": entity_type,
                            "entity_id": entity_id,
                        }
                    )
                    continue

                title = f"{entity_type.title()} {entity_id} correlated anomaly"
                cur.execute(
                    """
                    INSERT INTO incidents (
                      entity_type, entity_id, severity, detector_events, tags, title, pre_explanation, status
                    )
                    VALUES (%s, %s, %s, %s::jsonb, %s::text[], %s, %s, 'open')
                    RETURNING id, severity, status
                    """,
                    (
                        entity_type,
                        entity_id,
                        int(consolidated["severity"]),
                        json.dumps(group),
                        [f"detector:{item.get('detector', 'unknown')}" for item in group],
                        title,
                        f"Rule-engine consolidation from {len(group)} detector events.",
                    ),
                )
                row = cur.fetchone()
                outputs.append(
                    {
                        "event_type": "incident_created",
                        "incident_id": int(row[0]),
                        "severity": int(row[1]),
                        "status": row[2],
                        "entity_type": entity_type,
                        "entity_id": entity_id,
                    }
                )
    return outputs
