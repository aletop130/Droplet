from __future__ import annotations

import re
from services.regolo import MODEL_CHAT


def _fallback_route(message: str) -> dict:
    lowered = message.lower()
    comune_match = re.search(r"\b(?:a|di|su|situazione a)\s+([A-ZÀ-Ý][\w' -]+)", message)
    if any(token in lowered for token in ["norma", "regol", "art.", "decreto"]):
        return {"intent": "regulatory_lookup", "confidence": 0.55, "comune": None, "entity_hint": None, "model": "fallback"}
    if any(token in lowered for token in ["kpi", "nrw", "ili"]):
        return {"intent": "lookup_kpi", "confidence": 0.55, "comune": comune_match.group(1).strip() if comune_match else None, "entity_hint": None, "model": "fallback"}
    if comune_match:
        return {"intent": "diagnosis_geo", "confidence": 0.5, "comune": comune_match.group(1).strip(), "entity_hint": None, "model": "fallback"}
    return {"intent": "chitchat", "confidence": 0.4, "comune": None, "entity_hint": None, "model": "fallback"}


def _local_route(message: str, page_context: dict | None = None) -> dict:
    lowered = message.lower()
    entity_type = (page_context or {}).get("entity_type")
    entity_id = (page_context or {}).get("entity_id")
    if any(token in lowered for token in ["norma", "regol", "art.", "decreto", "delibera", "compliance", "arera"]):
        return {"intent": "regulatory_lookup", "confidence": 0.82, "comune": None, "entity_hint": None, "model": "local"}
    if any(token in lowered for token in ["kpi", "nrw", "ili"]):
        route = _fallback_route(message)
        route.update({"intent": "lookup_kpi", "confidence": 0.8, "model": "local"})
        return route
    if entity_type == "tank" and entity_id:
        return {"intent": "diagnosis_tank", "confidence": 0.84, "comune": None, "entity_hint": entity_id, "model": "local"}
    if entity_type == "segment" and entity_id:
        return {"intent": "diagnosis_segment", "confidence": 0.84, "comune": None, "entity_hint": entity_id, "model": "local"}
    if any(token in lowered for token in ["confronta", "compare", "vs", "versus"]):
        return {"intent": "time_series_compare", "confidence": 0.72, "comune": None, "entity_hint": entity_id, "model": "local"}
    if any(token in lowered for token in ["scenario", "what-if", "cosa succede", "se cambio", "se aument"]):
        return {"intent": "what_if", "confidence": 0.72, "comune": None, "entity_hint": entity_id, "model": "local"}
    return _fallback_route(message)


def classify_intent(message: str, page_context: dict | None = None) -> dict:
    local = _local_route(message, page_context)
    local.setdefault("model", MODEL_CHAT)
    local.setdefault("confidence", 0.6)
    local.setdefault("intent", "chitchat")
    return local
