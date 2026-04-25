from fastapi import APIRouter, HTTPException

from db.supabase import get_connection
from models.dto import IncidentPatch


router = APIRouter(prefix="/api/incidents", tags=["incidents"])


@router.get("")
def list_incidents(severity: int | None = None, status: str | None = None):
    where = []
    params = []
    if severity is not None:
        where.append("severity = %s")
        params.append(severity)
    if status is not None:
        where.append("status = %s")
        params.append(status)
    clause = f"WHERE {' AND '.join(where)}" if where else ""
    query = f"""
        SELECT id, created_at, updated_at, entity_type, entity_id, severity, detector_events, tags,
               title, pre_explanation, status, assigned_to, resolved_at
        FROM incidents
        {clause}
        ORDER BY updated_at DESC
        LIMIT 200
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
    items = []
    for row in rows:
        items.append(
            {
                "id": row[0],
                "created_at": row[1].isoformat() if row[1] else None,
                "updated_at": row[2].isoformat() if row[2] else None,
                "entity_type": row[3],
                "entity_id": row[4],
                "severity": row[5],
                "detector_events": row[6] or [],
                "tags": row[7] or [],
                "title": row[8],
                "pre_explanation": row[9],
                "status": row[10],
                "assigned_to": row[11],
                "resolved_at": row[12].isoformat() if row[12] else None,
            }
        )
    return {"items": items, "total": len(items)}


@router.patch("/{incident_id}")
def patch_incident(incident_id: int, payload: IncidentPatch):
    updates = payload.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="no changes requested")
    sets = ["updated_at = NOW()"]
    params: list = []
    if "status" in updates:
        sets.append("status = %s")
        params.append(updates["status"])
        if updates["status"] == "resolved":
            sets.append("resolved_at = NOW()")
    if "assigned_to" in updates:
        sets.append("assigned_to = %s")
        params.append(updates["assigned_to"])
    params.append(incident_id)
    query = f"""
        UPDATE incidents
        SET {', '.join(sets)}
        WHERE id = %s
        RETURNING id, created_at, updated_at, entity_type, entity_id, severity, detector_events, tags,
                  title, pre_explanation, status, assigned_to, resolved_at
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="incident not found")
    return {
        "id": row[0],
        "created_at": row[1].isoformat() if row[1] else None,
        "updated_at": row[2].isoformat() if row[2] else None,
        "entity_type": row[3],
        "entity_id": row[4],
        "severity": row[5],
        "detector_events": row[6] or [],
        "tags": row[7] or [],
        "title": row[8],
        "pre_explanation": row[9],
        "status": row[10],
        "assigned_to": row[11],
        "resolved_at": row[12].isoformat() if row[12] else None,
    }
