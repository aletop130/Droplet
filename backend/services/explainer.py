from __future__ import annotations

import asyncio
import json
import time
from typing import AsyncIterator

from services.agent import run_agent
from services.db import extract_tank_latest_balance, get_segment_detail, get_tank_detail, get_tank_kpis
from services.regolo import RegoloUnavailable


def _chunk_text(text: str) -> list[str]:
    words = text.split()
    chunks = []
    current = []
    for word in words:
        current.append(word)
        if len(current) >= 8:
            chunks.append(" ".join(current) + " ")
            current = []
    if current:
        chunks.append(" ".join(current) + " ")
    return chunks or [text]


async def stream_explanation(entity_type: str, entity_id: int) -> AsyncIterator[str]:
    started = time.perf_counter()
    try:
        context = {"entity_type": entity_type, "entity_id": entity_id}
        if entity_type == "segment":
            context["segment"] = get_segment_detail(entity_id)
        elif entity_type == "tank":
            tank_detail = get_tank_detail(entity_id)
            context["tank"] = tank_detail
            context["tank_balance"] = extract_tank_latest_balance(tank_detail or {}, entity_id) if tank_detail else {"tank_id": entity_id, "flag": "unknown"}
            context["tank_kpi"] = get_tank_kpis(entity_id, detail=tank_detail)
        result = run_agent(
            user_message=f"Spiega lo stato operativo di {entity_type} {entity_id} in italiano, con CONTEXT, ANALYSIS, RECOMMENDATION, UNCERTAINTY e CITATIONS.",
            purpose="explain",
            context=context,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        for token in _chunk_text(result["answer"]):
            yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
            await asyncio.sleep(0.02)
        yield f"data: {json.dumps({'done': True, 'citations': result.get('citations', []), 'audit_log_id': result.get('audit_log_id')})}\n\n"
    except RegoloUnavailable:
        yield f"data: {json.dumps({'token': 'Analisi AI temporaneamente non disponibile. Sto mostrando il contesto essenziale disponibile.', 'done': False})}\n\n"
        yield f"data: {json.dumps({'done': True, 'citations': [], 'audit_log_id': None})}\n\n"
    except Exception as exc:
        print(f"[explain-error] entity_type={entity_type} entity_id={entity_id}: {exc}")
        payload = {
            "token": "Spiegazione non completata. Sto mantenendo disponibile il contesto operativo di base per l entita corrente.",
            "done": False,
        }
        yield f"data: {json.dumps(payload)}\n\n"
        yield f"data: {json.dumps({'done': True, 'citations': [], 'audit_log_id': None})}\n\n"
    finally:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        print(f"[latency] explain entity_type={entity_type} entity_id={entity_id} total_ms={elapsed_ms}")
