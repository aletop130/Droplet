import json
import os
import time
from typing import Any

from db.supabase import get_connection


def write_ai_audit_log(
    *,
    purpose: str,
    request_payload: dict[str, Any],
    response_text: str,
    model: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    incident_id: int | None = None,
    confidence: float | None = None,
    tool_calls: list[dict[str, Any]] | None = None,
    retrieved_doc_ids: list[str] | None = None,
    graph_path: dict[str, Any] | list[Any] | None = None,
    operator_action: str | None = None,
    operator_id: str | None = None,
    operator_note: str | None = None,
    token_usage: dict[str, Any] | None = None,
    started_at: float | None = None,
) -> int | None:
    latency_ms = int((time.perf_counter() - started_at) * 1000) if started_at else None
    try:
        with get_connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai_audit_log (
                  model, purpose, entity_type, entity_id, incident_id,
                  request_payload, response_text, confidence, tool_calls,
                  retrieved_doc_ids, graph_path, explanation_chain,
                  operator_action, operator_id, operator_note, latency_ms, token_usage
                )
                VALUES (
                  %(model)s, %(purpose)s, %(entity_type)s, %(entity_id)s, %(incident_id)s,
                  %(request_payload)s::jsonb, %(response_text)s, %(confidence)s, %(tool_calls)s::jsonb,
                  %(retrieved_doc_ids)s, %(graph_path)s::jsonb, %(explanation_chain)s::jsonb,
                  %(operator_action)s, %(operator_id)s, %(operator_note)s, %(latency_ms)s, %(token_usage)s::jsonb
                )
                RETURNING id
                """,
                {
                    "model": model or os.getenv("REGOLO_MODEL_ORCHESTRATOR", "gpt-oss-120b"),
                    "purpose": purpose,
                    "entity_type": entity_type,
                    "entity_id": entity_id,
                    "incident_id": incident_id,
                    "request_payload": json.dumps(request_payload),
                    "response_text": response_text,
                    "confidence": confidence,
                    "tool_calls": json.dumps(tool_calls or []),
                    "retrieved_doc_ids": retrieved_doc_ids,
                    "graph_path": json.dumps(graph_path or {}),
                    "explanation_chain": json.dumps({}),
                    "operator_action": operator_action,
                    "operator_id": operator_id,
                    "operator_note": operator_note,
                    "latency_ms": latency_ms,
                    "token_usage": json.dumps(token_usage or {}),
                },
            )
            return cur.fetchone()[0]
    except Exception as exc:
        print(f"[audit-warning] failed to write ai_audit_log purpose={purpose}: {exc}")
        return None
