from db.supabase import get_connection


def propose_control_change(
    entity_type: str,
    entity_id: int,
    parameter: str,
    proposed_value: float,
    rationale: str,
    expected_impact: dict,
) -> dict:
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO control_recommendations (
              incident_id, entity_type, entity_id, parameter, current_value, proposed_value,
              rationale, expected_impact, confidence, risk_flags, status
            )
            VALUES (NULL, %s, %s, %s, NULL, %s, %s, %s::jsonb, %s, %s, 'proposed')
            RETURNING id, created_at
            """,
            (
                entity_type,
                entity_id,
                parameter,
                proposed_value,
                rationale,
                __import__("json").dumps(expected_impact),
                0.68,
                ["human_approval_required"],
            ),
        )
        row = cur.fetchone()
    return {
        "id": row[0],
        "created_at": row[1].isoformat() if row and row[1] else None,
        "incident_id": None,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "parameter": parameter,
        "current_value": None,
        "proposed_value": proposed_value,
        "rationale": rationale,
        "expected_impact": expected_impact,
        "confidence": 0.68,
        "risk_flags": ["human_approval_required"],
        "status": "proposed",
    }
