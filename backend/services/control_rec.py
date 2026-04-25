from __future__ import annotations

from db.supabase import get_connection
from services.audit import write_ai_audit_log


def list_control_recommendations(status: str | None = None):
    where = "WHERE status = %s" if status else ""
    params = (status,) if status else ()
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, incident_id, entity_type, entity_id, parameter, current_value, proposed_value,
                   rationale, expected_impact, confidence, risk_flags, status, approved_by, approved_at, created_at
            FROM control_recommendations
            {where}
            ORDER BY created_at DESC
            """,
            params,
        )
        rows = cur.fetchall()
    return [
        {
            "id": row[0],
            "incident_id": row[1],
            "entity_type": row[2],
            "entity_id": row[3],
            "parameter": row[4],
            "current_value": row[5],
            "proposed_value": row[6],
            "rationale": row[7],
            "expected_impact": row[8] or {},
            "confidence": float(row[9] or 0.0),
            "risk_flags": row[10] or [],
            "status": row[11],
            "approved_by": row[12],
            "approved_at": row[13].isoformat() if row[13] else None,
            "created_at": row[14].isoformat() if row[14] else None,
        }
        for row in rows
    ]


def approve_control_recommendation(rec_id: int, operator_id: str):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE control_recommendations
            SET status = 'applied_in_sim', approved_by = %s, approved_at = NOW()
            WHERE id = %s
            RETURNING id, incident_id, entity_type, entity_id, parameter, current_value, proposed_value,
                      rationale, expected_impact, confidence, risk_flags, status, approved_by, approved_at, created_at
            """,
            (operator_id, rec_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    item = {
        "id": row[0],
        "incident_id": row[1],
        "entity_type": row[2],
        "entity_id": row[3],
        "parameter": row[4],
        "current_value": row[5],
        "proposed_value": row[6],
        "rationale": row[7],
        "expected_impact": row[8] or {},
        "confidence": float(row[9] or 0.0),
        "risk_flags": row[10] or [],
        "status": row[11],
        "approved_by": row[12],
        "approved_at": row[13].isoformat() if row[13] else None,
        "created_at": row[14].isoformat() if row[14] else None,
    }
    write_ai_audit_log(
        purpose="control_recommendation",
        entity_type=item["entity_type"],
        entity_id=item["entity_id"],
        incident_id=item.get("incident_id"),
        request_payload={"id": rec_id, "operator_id": operator_id, "action": "approve"},
        response_text=f"Control recommendation {rec_id} approved and applied to digital twin only.",
        confidence=item.get("confidence"),
        tool_calls=[{"tool": "control_rec.approve", "input": {"id": rec_id}, "output_ref": "sim_state"}],
        operator_action="accepted",
        operator_id=operator_id,
    )
    return item


def reject_control_recommendation(rec_id: int, operator_id: str, reason: str | None):
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE control_recommendations
            SET status = 'rejected', approved_by = %s, approved_at = NOW()
            WHERE id = %s
            RETURNING id, incident_id, entity_type, entity_id, parameter, current_value, proposed_value,
                      rationale, expected_impact, confidence, risk_flags, status, approved_by, approved_at, created_at
            """,
            (operator_id, rec_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    item = {
        "id": row[0],
        "incident_id": row[1],
        "entity_type": row[2],
        "entity_id": row[3],
        "parameter": row[4],
        "current_value": row[5],
        "proposed_value": row[6],
        "rationale": row[7],
        "expected_impact": row[8] or {},
        "confidence": float(row[9] or 0.0),
        "risk_flags": row[10] or [],
        "status": row[11],
        "approved_by": row[12],
        "approved_at": row[13].isoformat() if row[13] else None,
        "created_at": row[14].isoformat() if row[14] else None,
    }
    write_ai_audit_log(
        purpose="control_recommendation",
        entity_type=item["entity_type"],
        entity_id=item["entity_id"],
        incident_id=item.get("incident_id"),
        request_payload={"id": rec_id, "operator_id": operator_id, "action": "reject", "reason": reason},
        response_text=f"Control recommendation {rec_id} rejected by operator.",
        confidence=item.get("confidence"),
        tool_calls=[{"tool": "control_rec.reject", "input": {"id": rec_id}, "output_ref": "operator_action"}],
        operator_action="dismissed",
        operator_id=operator_id,
        operator_note=reason,
    )
    return item
