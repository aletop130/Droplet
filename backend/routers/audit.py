from fastapi import APIRouter

from db.supabase import get_connection

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def list_audit(entity_type: str | None = None, entity_id: int | None = None, purpose: str | None = None):
    where = []
    params = {}
    if entity_type:
        where.append("entity_type = %(entity_type)s")
        params["entity_type"] = entity_type
    if entity_id is not None:
        where.append("entity_id = %(entity_id)s")
        params["entity_id"] = entity_id
    if purpose:
        where.append("purpose = %(purpose)s")
        params["purpose"] = purpose
    sql = """
        SELECT id, ts, model, purpose, entity_type, entity_id, response_text,
               confidence, operator_action, latency_ms
        FROM ai_audit_log
    """
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY ts DESC LIMIT 50"
    try:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            rows = [
                {
                    "id": row[0],
                    "ts": row[1].isoformat(),
                    "model": row[2],
                    "purpose": row[3],
                    "entity_type": row[4],
                    "entity_id": row[5],
                    "response_text": row[6],
                    "confidence": row[7],
                    "operator_action": row[8],
                    "latency_ms": row[9],
                }
                for row in cur.fetchall()
            ]
        return {"items": rows, "total": len(rows)}
    except Exception as exc:
        print(f"[audit-warning] query failed: {exc}")
        return {"items": [], "total": 0, "warning": str(exc)}
