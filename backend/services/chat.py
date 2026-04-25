from __future__ import annotations

import asyncio
import base64
import binascii
import json
import re
import time
import traceback
from datetime import datetime
from functools import lru_cache
from typing import Any, AsyncIterator

from models.dto import ChatAttachment, ChatRequest
from services.agent_prompts import SYSTEM_PROMPT
from services.agent import run_agent
from services.db import (
    extract_tank_latest_balance,
    fetch_segments,
    get_network_overview,
    get_segments_for_municipality,
    get_tank_detail,
    get_tank_kpis,
    list_municipality_kpis,
)
from services.investments import (
    ARERA_INDICATORS,
    InvestmentInput,
    calculate_investment,
    db_saturation_status,
    get_investment_strategy,
)
from services.regolo import MODEL_CHAT, MODEL_ORCHESTRATOR, RegoloUnavailable, chat_completion, stream_chat_completion
from services.router.brick_router import classify_intent
from services.tools.search_docs import search_docs

CHAT_EXECUTION_TIMEOUT_S = 45.0
CHAT_MAX_RETRIES = 3
CHAT_RETRY_BASE_DELAY_S = 2.0
DMA_PHI_RE = re.compile(r"\bdma\s*#?\s*(\d+)\b", re.IGNORECASE)
TEXT_ATTACHMENT_MIME_PREFIXES = ("text/",)
TEXT_ATTACHMENT_MIME_TYPES = {
    "application/json",
    "application/xml",
    "application/csv",
    "application/x-ndjson",
}
TEXT_ATTACHMENT_SUFFIXES = (".txt", ".md", ".csv", ".json", ".xml", ".log")
MAX_ATTACHMENT_TEXT_CHARS = 12000


def _chunk_text(text: str) -> list[str]:
    chunks: list[str] = []
    block: list[str] = []

    def flush_block() -> None:
        nonlocal block
        if block:
            chunks.append("".join(block))
            block = []

    for line in text.splitlines(keepends=True):
        stripped = line.strip()
        is_table_line = stripped.startswith("|") and stripped.endswith("|")
        if is_table_line:
            block.append(line)
            continue
        flush_block()
        if len(line) <= 180:
            chunks.append(line)
        else:
            for index in range(0, len(line), 180):
                chunks.append(line[index : index + 180])
    flush_block()
    return chunks or [text]


def _split_data_url(data_url: str | None) -> tuple[str | None, str | None]:
    if not data_url:
        return None, None
    if data_url.startswith("data:") and "," in data_url:
        header, data = data_url.split(",", 1)
        media_type = header[5:].split(";", 1)[0] or None
        return media_type, data
    return None, data_url


def _decode_text_attachment(attachment: ChatAttachment) -> str | None:
    media_type, encoded = _split_data_url(attachment.data_url)
    mime_type = (attachment.mime_type or media_type or "").lower()
    name = attachment.name.lower()
    is_text = (
        mime_type.startswith(TEXT_ATTACHMENT_MIME_PREFIXES)
        or mime_type in TEXT_ATTACHMENT_MIME_TYPES
        or name.endswith(TEXT_ATTACHMENT_SUFFIXES)
    )
    if not is_text or not encoded:
        return None
    try:
        raw = base64.b64decode(encoded, validate=False)
    except (binascii.Error, ValueError):
        return None
    text = raw.decode("utf-8", errors="replace").strip()
    if len(text) > MAX_ATTACHMENT_TEXT_CHARS:
        return text[:MAX_ATTACHMENT_TEXT_CHARS] + "\n[truncated]"
    return text


def _audio_format(attachment: ChatAttachment) -> str:
    name = attachment.name.lower()
    mime_type = attachment.mime_type.lower()
    if "wav" in mime_type or name.endswith(".wav"):
        return "wav"
    if "mpeg" in mime_type or "mp3" in mime_type or name.endswith(".mp3"):
        return "mp3"
    if "ogg" in mime_type or name.endswith(".ogg"):
        return "ogg"
    if "webm" in mime_type or name.endswith(".webm"):
        return "webm"
    if "m4a" in mime_type or name.endswith(".m4a"):
        return "m4a"
    return "mp3"


def _attachment_summary(attachments: list[ChatAttachment]) -> list[dict[str, Any]]:
    return [
        {
            "name": item.name,
            "mime_type": item.mime_type,
            "kind": item.kind,
            "size_bytes": item.size_bytes,
        }
        for item in attachments
    ]


def _redact_payload_for_log(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: ("[redacted data_url]" if key == "data_url" and isinstance(item, str) else _redact_payload_for_log(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_payload_for_log(item) for item in value]
    return value


def _build_user_content(
    user_message: str,
    context: dict[str, Any],
    attachments: list[ChatAttachment] | None = None,
    *,
    include_binary_parts: bool = True,
) -> str | list[dict[str, Any]]:
    attachments = attachments or []
    text_payload = {
        "message": user_message,
        "context": context,
        "attachments": _attachment_summary(attachments),
    }
    text_parts = [json.dumps(text_payload, ensure_ascii=False)]
    content_parts: list[dict[str, Any]] = []

    for attachment in attachments:
        extracted_text = _decode_text_attachment(attachment)
        if extracted_text:
            text_parts.append(f"\n\nAttachment text: {attachment.name}\n{extracted_text}")
        elif attachment.kind in {"audio", "document"}:
            text_parts.append(
                "\n\nAttachment metadata: {name} ({kind}, {mime_type}, {size_bytes} bytes). "
                "No safe text extraction was available for this binary file in the current chat pipeline.".format(
                    name=attachment.name,
                    kind=attachment.kind,
                    mime_type=attachment.mime_type,
                    size_bytes=attachment.size_bytes,
                )
            )

    content_parts.append({"type": "text", "text": "\n".join(text_parts)})

    for attachment in attachments:
        media_type, encoded = _split_data_url(attachment.data_url)
        data_url = attachment.data_url
        if not data_url:
            continue
        if attachment.kind == "image":
            content_parts.append({"type": "image_url", "image_url": {"url": data_url}})
        elif include_binary_parts:
            content_parts.append(
                {
                    "type": "file",
                    "file": {
                        "filename": attachment.name,
                        "file_data": data_url,
                        "mime_type": attachment.mime_type or media_type or "application/octet-stream",
                    },
                }
            )

    return content_parts if attachments else text_parts[0]


def _context_messages(
    user_message: str,
    context: dict[str, Any],
    attachments: list[ChatAttachment] | None = None,
    *,
    include_binary_parts: bool = True,
) -> list[dict[str, Any]]:
    return [
        {
            "role": "system",
            "content": (
                SYSTEM_PROMPT
                + "\nUse the provided JSON context as your primary source of truth. "
                + "Do not ask for extra tools. If context is partial, say exactly what is partial."
                + "\nIf attachments are present, inspect them directly when possible and combine their evidence with the JSON context. "
                + "State clearly when a file type could not be inspected directly."
            ),
        },
        {
            "role": "user",
            "content": _build_user_content(user_message, context, attachments, include_binary_parts=include_binary_parts),
        },
    ]


def _investment_messages(
    user_message: str,
    context: dict[str, Any],
    attachments: list[ChatAttachment] | None = None,
    *,
    include_binary_parts: bool = True,
) -> list[dict[str, Any]]:
    return [
        {
            "role": "system",
            "content": (
                "You are Droplet Investments Agent. Answer only about water investment strategy, GIS overlay, "
                "hydrogeology, ARERA quality indicators, ROI and payback. Use the JSON context as source of truth. "
                "For substantive investment analysis, use sections: CONTEXT, ANALYSIS, RECOMMENDATION, UNCERTAINTY, CITATIONS. "
                "For greetings, confirmations, clarifying questions, and simple qualitative answers, respond briefly without forcing sections or tables. "
                "Use valid GitHub-flavored Markdown. Prefer short paragraphs or bullets. Use compact tables only when comparing concrete opportunities, indicators, or scenarios. "
                "Do not use emoji. If attachments are present, inspect them directly when possible and combine their evidence with the JSON context. "
                "Make clear this is hackathon mode using public or simulated data when giving investment estimates."
            ),
        },
        {
            "role": "user",
            "content": _build_user_content(user_message, context, attachments, include_binary_parts=include_binary_parts),
        },
    ]


def _lookup_kpi_context(message: str) -> dict[str, Any]:
    kpis = list_municipality_kpis()
    lowered = message.lower()
    match = next((item for item in kpis if item["comune"].lower() in lowered), None)
    if not match and kpis:
        match = kpis[0]
    return {
        "query": message,
        "selected": match,
        "available_count": len(kpis),
    }


def _extract_dma_phi_query(message: str) -> int | None:
    lowered = message.lower()
    if "phi" not in lowered or "segment" not in lowered:
        return None
    match = DMA_PHI_RE.search(message)
    if not match:
        return None
    return int(match.group(1))


@lru_cache(maxsize=8)
def _cached_global_context(minute_bucket: int) -> dict[str, Any]:
    context = get_network_overview()
    context["digest_generated_at"] = datetime.utcnow().isoformat()
    context["minute_bucket"] = minute_bucket
    return context


def _get_global_context() -> dict[str, Any]:
    return _cached_global_context(int(time.time() // 60))


def _respond_from_context(user_message: str, context: dict[str, Any]) -> dict[str, Any]:
    response = chat_completion(
        model=MODEL_ORCHESTRATOR,
        messages=_context_messages(user_message, context),
        tools=None,
        tool_choice=None,
        temperature=0.1,
    )
    content = response["choices"][0]["message"].get("content") or ""
    if not content.strip():
        raise RegoloUnavailable("Regolo returned an empty chat message")
    return {
        "answer": content,
        "citations": [],
        "suggested_actions": [],
        "audit_log_id": None,
        "token_usage": response.get("usage") or {},
    }


def _build_investment_context(user_message: str) -> dict[str, Any]:
    default_calculation = calculate_investment(InvestmentInput())
    strategy = get_investment_strategy(roi_target_pct=25.0)
    return {
        "query": user_message,
        "agent_mode": "investments",
        "strategy": {
            "summary": strategy["summary"],
            "roi_target_pct": strategy["roi_target_pct"],
            "opportunities": [
                {
                    "node_id": item["properties"]["node_id"],
                    "falde_id": item["properties"]["falde_id"],
                    "depth_m": item["properties"]["profondita_m"],
                    "water_type": item["properties"]["tipo_acqua"],
                    "historic_consumption_m3_year": item["properties"]["consumo_storico"],
                    "current_yield": item["properties"]["rendimento_attuale"],
                    "priority": item["properties"]["intervento_priorita"],
                    "estimated_cost_eur": item["properties"]["estimated_cost_eur"],
                    "arera_roi_pct": item["properties"]["arera_roi_pct"],
                    "payback_years": item["properties"]["payback_years"],
                    "recommended_action": item["properties"]["recommended_action"],
                    "coordinates": item["geometry"]["coordinates"],
                }
                for item in strategy["opportunities"][:6]
            ],
        },
        "arera_indicators": ARERA_INDICATORS,
        "default_calculation": default_calculation,
        "db_saturation": db_saturation_status(),
        "hackathon_constraints": [
            "Use only public or simulated data in this build.",
            "Do not present estimates as production financial advice.",
            "Recommend validation against current ARERA determinations, regional hydrogeology and updated tariffs.",
            "Depuration is intentionally out of scope; focus on virgin water/source/network investment.",
        ],
    }


def _investment_fallback_answer(context: dict[str, Any]) -> str:
    opportunities = context["strategy"]["opportunities"]
    indicators = context["arera_indicators"]
    calculation = context["default_calculation"]
    rows = "\n".join(
        "| {node} | {priority} | {roi:.1f}% | {payback:.1f} yr | {cost:,.0f} EUR | {action} |".format(
            node=item["node_id"],
            priority=item["priority"],
            roi=float(item["arera_roi_pct"]),
            payback=float(item["payback_years"]),
            cost=float(item["estimated_cost_eur"]),
            action=item["recommended_action"],
        )
        for item in opportunities[:4]
    )
    indicator_rows = "\n".join(
        "| {code} | {label} | {weight:.0f}% | {current:.0f}% | {target:.0f}% |".format(
            code=item["code"],
            label=item["label"],
            weight=float(item["weight"]) * 100,
            current=float(item["current"]) * 100,
            target=float(item["target"]) * 100,
        )
        for item in indicators
    )
    return (
        "CONTEXT\n\n"
        "Investment agent is active. I used the GIS/hydrogeology overlay, ARERA indicator weights, default ROI calculator and database saturation check.\n\n"
        "ANALYSIS\n\n"
        "| Node | Priority | ROI | Payback | Estimated cost | Action |\n"
        "|---|---:|---:|---:|---:|---|\n"
        f"{rows}\n\n"
        "| Indicator | Meaning | Weight | Current | Target |\n"
        "|---|---|---:|---:|---:|\n"
        f"{indicator_rows}\n\n"
        "RECOMMENDATION\n\n"
        f"- Default investment calculation returns **{calculation['roi_pct']:.1f}% ROI** and **{calculation['payback_years']:.1f} years payback**.\n"
        "- Prioritize opportunities above the 25% ROI target where high consumption overlaps critical hydrogeology and low network yield.\n"
        "- Keep batch writes paused if DB saturation reaches the configured 80% threshold.\n\n"
        "UNCERTAINTY\n\n"
        "- Hackathon mode: data is public or simulated. Validate with current ARERA determinations, regional hydrogeology and updated tariff/cost data before real investment decisions.\n\n"
        "CITATIONS\n\n"
        "- Internal tools: investment_strategy, arera_indicators, investment_calculator, db_saturation_status."
    )


def _respond_investment_agent(user_message: str, context: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    try:
        response = chat_completion(
            model=MODEL_ORCHESTRATOR,
            messages=_investment_messages(user_message, context),
            tools=None,
            tool_choice=None,
            temperature=0.1,
        )
        content = response["choices"][0]["message"].get("content") or ""
        if not content.strip():
            raise RegoloUnavailable("Regolo returned an empty investments message")
        usage = response.get("usage") or {}
    except Exception:
        content = _investment_fallback_answer(context)
        usage = {}
    return {
        "answer": content,
        "citations": [{"doc_ids": ["investment_strategy", "arera_indicators", "investment_calculator"]}],
        "suggested_actions": [],
        "audit_log_id": None,
        "token_usage": usage,
        "timing_breakdown": {"investment_agent_ms": int((time.perf_counter() - started) * 1000)},
    }


def _build_streaming_plan(payload: ChatRequest) -> dict[str, Any] | None:
    timings: dict[str, int] = {}
    attachments = payload.attachments
    route_started = time.perf_counter()
    if payload.agent_mode == "investments":
        investment_started = time.perf_counter()
        investment_context = _build_investment_context(payload.message)
        timings["investment_context_ms"] = int((time.perf_counter() - investment_started) * 1000)
        return {
            "messages": _investment_messages(payload.message, investment_context, attachments),
            "fallback_messages": _investment_messages(payload.message, investment_context, attachments, include_binary_parts=False),
            "model": MODEL_CHAT if attachments else MODEL_ORCHESTRATOR,
            "citations": [{"doc_ids": ["investment_strategy", "arera_indicators", "investment_calculator"]}],
            "audit_log_id": None,
            "suggested_actions": [],
            "timing_breakdown": timings,
        }

    routed = classify_intent(payload.message, payload.page_context.model_dump())
    timings["route_ms"] = int((time.perf_counter() - route_started) * 1000)

    context: dict[str, Any] = {
        "route": payload.page_context.route,
        "selected_window": payload.page_context.selected_window,
        "entity_type": payload.page_context.entity_type,
        "entity_id": payload.page_context.entity_id,
    }
    citations: list[dict[str, Any]] = []
    dma_phi_id = _extract_dma_phi_query(payload.message)
    if dma_phi_id is not None:
        dma_started = time.perf_counter()
        segments = fetch_segments(dma_id=dma_phi_id)
        top_segments = segments.get("features", [])[:12]
        context["dma_phi_lookup"] = {
            "dma_id": dma_phi_id,
            "segment_count": len(segments.get("features", [])),
            "top_segments": [
                {
                    "id": feature["properties"]["id"],
                    "dma_id": feature["properties"]["dma_id"],
                    "phi": feature["properties"]["phi"],
                    "phi_confidence": feature["properties"]["phi_confidence"],
                    "latest_ts": feature["properties"]["latest_ts"],
                    "subsidence": feature["properties"]["subsidence"],
                    "ndvi": feature["properties"]["ndvi"],
                    "thermal": feature["properties"]["thermal"],
                    "hydraulic": feature["properties"]["hydraulic"],
                    "tank_signal": feature["properties"]["tank_signal"],
                    "explanation": feature["properties"]["explanation"],
                }
                for feature in top_segments
            ],
        }
        timings["dma_phi_lookup_ms"] = int((time.perf_counter() - dma_started) * 1000)
        citations = [{"doc_ids": [f"segment:{feature['properties']['id']}" for feature in top_segments[:3]]}]
    elif routed["intent"] == "lookup_kpi":
        kpi_started = time.perf_counter()
        context["kpi_lookup"] = _lookup_kpi_context(payload.message)
        timings["kpi_lookup_ms"] = int((time.perf_counter() - kpi_started) * 1000)
        if context["kpi_lookup"].get("selected"):
            citations = [{"doc_ids": [f"kpi:{context['kpi_lookup']['selected']['comune']}"]}]
    elif routed["intent"] == "regulatory_lookup":
        docs_started = time.perf_counter()
        docs = search_docs(payload.message, top_k=4)
        context["regulatory_lookup"] = docs
        timings["docs_ms"] = int((time.perf_counter() - docs_started) * 1000)
        citations = [{"doc_ids": [doc["id"] for doc in docs["documents"]]}]
    elif payload.page_context.entity_type is None and payload.page_context.entity_id is None:
        if attachments:
            context["attachment_mode"] = True
            context["note"] = "Global network context omitted to keep multimodal requests low-latency."
        else:
            global_started = time.perf_counter()
            context["global_context"] = _get_global_context()
            timings["global_context_ms"] = int((time.perf_counter() - global_started) * 1000)
    elif payload.page_context.entity_type == "tank" and payload.page_context.entity_id:
        tank_started = time.perf_counter()
        detail = get_tank_detail(payload.page_context.entity_id)
        if detail:
            context["tank_detail"] = detail
            context["tank_balance"] = extract_tank_latest_balance(detail, payload.page_context.entity_id)
            context["tank_kpi"] = get_tank_kpis(payload.page_context.entity_id, detail=detail)
        timings["tank_prefetch_ms"] = int((time.perf_counter() - tank_started) * 1000)
    else:
        if not attachments:
            return None

    return {
        "messages": _context_messages(payload.message, context, attachments),
        "fallback_messages": _context_messages(payload.message, context, attachments, include_binary_parts=False),
        "model": MODEL_CHAT if attachments else MODEL_ORCHESTRATOR,
        "citations": citations,
        "audit_log_id": None,
        "suggested_actions": [],
        "timing_breakdown": timings,
    }


def _build_chat_result(payload: ChatRequest) -> dict[str, Any]:
    timings: dict[str, int] = {}
    route_started = time.perf_counter()
    if payload.agent_mode == "investments":
        investment_started = time.perf_counter()
        investment_context = _build_investment_context(payload.message)
        timings["investment_context_ms"] = int((time.perf_counter() - investment_started) * 1000)
        result = _respond_investment_agent(payload.message, investment_context)
        result["timing_breakdown"] = {**timings, **(result.get("timing_breakdown") or {})}
        return result

    routed = classify_intent(payload.message, payload.page_context.model_dump())
    timings["route_ms"] = int((time.perf_counter() - route_started) * 1000)

    context: dict[str, Any] = {
        "route": payload.page_context.route,
        "selected_window": payload.page_context.selected_window,
        "entity_type": payload.page_context.entity_type,
        "entity_id": payload.page_context.entity_id,
    }
    dma_phi_id = _extract_dma_phi_query(payload.message)
    if dma_phi_id is not None:
        dma_started = time.perf_counter()
        segments = fetch_segments(dma_id=dma_phi_id)
        top_segments = segments.get("features", [])[:12]
        context["dma_phi_lookup"] = {
            "dma_id": dma_phi_id,
            "segment_count": len(segments.get("features", [])),
            "top_segments": [
                {
                    "id": feature["properties"]["id"],
                    "dma_id": feature["properties"]["dma_id"],
                    "phi": feature["properties"]["phi"],
                    "phi_confidence": feature["properties"]["phi_confidence"],
                    "latest_ts": feature["properties"]["latest_ts"],
                    "subsidence": feature["properties"]["subsidence"],
                    "ndvi": feature["properties"]["ndvi"],
                    "thermal": feature["properties"]["thermal"],
                    "hydraulic": feature["properties"]["hydraulic"],
                    "tank_signal": feature["properties"]["tank_signal"],
                    "explanation": feature["properties"]["explanation"],
                }
                for feature in top_segments
            ],
        }
        timings["dma_phi_lookup_ms"] = int((time.perf_counter() - dma_started) * 1000)
        llm_started = time.perf_counter()
        result = _respond_from_context(payload.message, context)
        timings["context_response_ms"] = int((time.perf_counter() - llm_started) * 1000)
        result["timing_breakdown"] = {**timings, **(result.get("timing_breakdown") or {})}
        result["citations"] = [{"doc_ids": [f"segment:{feature['properties']['id']}" for feature in top_segments[:3]]}]
        return result
    if routed["intent"] == "lookup_kpi":
        kpi_started = time.perf_counter()
        context["kpi_lookup"] = _lookup_kpi_context(payload.message)
        timings["kpi_lookup_ms"] = int((time.perf_counter() - kpi_started) * 1000)
        llm_started = time.perf_counter()
        result = _respond_from_context(payload.message, context)
        timings["context_response_ms"] = int((time.perf_counter() - llm_started) * 1000)
        result["timing_breakdown"] = {**timings, **(result.get("timing_breakdown") or {})}
        if context["kpi_lookup"].get("selected"):
            result["citations"] = [{"doc_ids": [f"kpi:{context['kpi_lookup']['selected']['comune']}"]}]
        return result
    if routed["intent"] == "regulatory_lookup":
        docs_started = time.perf_counter()
        docs = search_docs(payload.message, top_k=4)
        context["regulatory_lookup"] = docs
        timings["docs_ms"] = int((time.perf_counter() - docs_started) * 1000)
        llm_started = time.perf_counter()
        result = _respond_from_context(payload.message, context)
        timings["context_response_ms"] = int((time.perf_counter() - llm_started) * 1000)
        result["timing_breakdown"] = {**timings, **(result.get("timing_breakdown") or {})}
        result["citations"] = [{"doc_ids": [doc["id"] for doc in docs["documents"]]}]
        return result
    if payload.page_context.entity_type is None and payload.page_context.entity_id is None:
        global_started = time.perf_counter()
        context["global_context"] = _get_global_context()
        timings["global_context_ms"] = int((time.perf_counter() - global_started) * 1000)
        llm_started = time.perf_counter()
        result = _respond_from_context(payload.message, context)
        timings["context_response_ms"] = int((time.perf_counter() - llm_started) * 1000)
        result["timing_breakdown"] = {**timings, **(result.get("timing_breakdown") or {})}
        return result
    if routed["intent"] == "diagnosis_geo" and routed.get("comune"):
        geo_started = time.perf_counter()
        context["geo_lookup"] = get_segments_for_municipality(routed["comune"])
        timings["geo_lookup_ms"] = int((time.perf_counter() - geo_started) * 1000)
    if payload.page_context.entity_type == "tank" and payload.page_context.entity_id:
        tank_started = time.perf_counter()
        detail = get_tank_detail(payload.page_context.entity_id)
        if detail:
            context["tank_detail"] = detail
            context["tank_balance"] = extract_tank_latest_balance(detail, payload.page_context.entity_id)
            context["tank_kpi"] = get_tank_kpis(payload.page_context.entity_id, detail=detail)
        timings["tank_prefetch_ms"] = int((time.perf_counter() - tank_started) * 1000)
        llm_started = time.perf_counter()
        result = _respond_from_context(payload.message, context)
        timings["context_response_ms"] = int((time.perf_counter() - llm_started) * 1000)
        result["timing_breakdown"] = {**timings, **(result.get("timing_breakdown") or {})}
        return result
    agent_started = time.perf_counter()
    result = run_agent(
        user_message=payload.message,
        purpose="chat",
        context=context,
        entity_type=payload.page_context.entity_type,
        entity_id=payload.page_context.entity_id,
        session_id=payload.session_id,
    )
    timings["agent_ms"] = int((time.perf_counter() - agent_started) * 1000)
    result["timing_breakdown"] = {**timings, **(result.get("timing_breakdown") or {})}
    return result


def _log_chat_failure(payload: ChatRequest, exc: BaseException, *, attempt: int, final: bool, elapsed_ms: int) -> None:
    try:
        payload_json = json.dumps(_redact_payload_for_log(payload.model_dump(mode="json")), ensure_ascii=False)
    except Exception:
        payload_json = repr(payload)
    print(
        "[chat-error] session_id={session} attempt={attempt} final={final} elapsed_ms={elapsed} "
        "error_type={error_type} error={error}\npayload={payload}\ntraceback={traceback}".format(
            session=payload.session_id,
            attempt=attempt,
            final=final,
            elapsed=elapsed_ms,
            error_type=exc.__class__.__name__,
            error=str(exc),
            payload=payload_json,
            traceback=traceback.format_exc(),
        )
    )


async def _build_chat_result_with_retry(payload: ChatRequest) -> dict[str, Any]:
    started = time.perf_counter()
    for attempt in range(1, CHAT_MAX_RETRIES + 1):
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(_build_chat_result, payload),
                timeout=CHAT_EXECUTION_TIMEOUT_S,
            )
        except (TimeoutError, RegoloUnavailable) as exc:
            final = attempt == CHAT_MAX_RETRIES
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            _log_chat_failure(payload, exc, attempt=attempt, final=final, elapsed_ms=elapsed_ms)
            if final:
                raise
            await asyncio.sleep(CHAT_RETRY_BASE_DELAY_S * (2 ** (attempt - 1)))
        except Exception as exc:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            _log_chat_failure(payload, exc, attempt=attempt, final=True, elapsed_ms=elapsed_ms)
            raise
    raise RuntimeError("Chat retry loop exited unexpectedly")


async def stream_chat(payload: ChatRequest) -> AsyncIterator[str]:
    started = time.perf_counter()
    emitted_tokens = False
    try:
        streaming_plan = await asyncio.to_thread(_build_streaming_plan, payload)
        if streaming_plan is not None:
            answer_parts: list[str] = []
            try:
                async for token in stream_chat_completion(
                    model=streaming_plan.get("model", MODEL_ORCHESTRATOR),
                    messages=streaming_plan["messages"],
                    tools=None,
                    tool_choice=None,
                    temperature=0.1,
                ):
                    emitted_tokens = True
                    answer_parts.append(token)
                    yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
            except RegoloUnavailable:
                if emitted_tokens:
                    raise
                answer_parts = []
                async for token in stream_chat_completion(
                    model=streaming_plan.get("model", MODEL_ORCHESTRATOR),
                    messages=streaming_plan.get("fallback_messages") or streaming_plan["messages"],
                    tools=None,
                    tool_choice=None,
                    temperature=0.1,
                ):
                    emitted_tokens = True
                    answer_parts.append(token)
                    yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
            answer = "".join(answer_parts)
            if not answer.strip():
                raise RegoloUnavailable("Regolo returned an empty streaming chat message")
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            print(
                "[latency] chat-stream session_id={session} route={route} entity_type={entity_type} entity_id={entity_id} total_ms={total} breakdown={breakdown}".format(
                    session=payload.session_id,
                    route=payload.page_context.route,
                    entity_type=payload.page_context.entity_type,
                    entity_id=payload.page_context.entity_id,
                    total=elapsed_ms,
                    breakdown=streaming_plan.get("timing_breakdown", {}),
                )
            )
            yield f"data: {json.dumps({'done': True, 'citations': streaming_plan.get('citations', []), 'audit_log_id': streaming_plan.get('audit_log_id'), 'suggested_actions': streaming_plan.get('suggested_actions', [])})}\n\n"
            return

        result = await _build_chat_result_with_retry(payload)
        answer = result.get("answer") or ""
        if not answer.strip():
            raise RuntimeError("Chat pipeline returned an empty answer")
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        _log_chat_failure(payload, exc, attempt=0, final=True, elapsed_ms=elapsed_ms)
        if emitted_tokens:
            yield (
                "data: "
                + json.dumps(
                    {
                        "done": True,
                        "error": str(exc),
                        "error_type": exc.__class__.__name__,
                        "latency_ms": elapsed_ms,
                    }
                )
                + "\n\n"
            )
            return
        try:
            result = await _build_chat_result_with_retry(payload)
            answer = result.get("answer") or ""
            if not answer.strip():
                raise RuntimeError("Chat pipeline returned an empty answer")
        except Exception as fallback_exc:
            _log_chat_failure(payload, fallback_exc, attempt=0, final=True, elapsed_ms=elapsed_ms)
            yield (
                "data: "
                + json.dumps(
                    {
                        "done": True,
                        "error": str(fallback_exc),
                        "error_type": fallback_exc.__class__.__name__,
                        "latency_ms": elapsed_ms,
                    }
                )
                + "\n\n"
            )
            return
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    print(
        "[latency] chat session_id={session} route={route} entity_type={entity_type} entity_id={entity_id} total_ms={total} breakdown={breakdown}".format(
            session=payload.session_id,
            route=payload.page_context.route,
            entity_type=payload.page_context.entity_type,
            entity_id=payload.page_context.entity_id,
            total=elapsed_ms,
            breakdown=result.get("timing_breakdown", {}),
        )
    )
    for token in _chunk_text(answer):
        yield f"data: {json.dumps({'token': token, 'done': False})}\n\n"
        await asyncio.sleep(0.02)
    yield f"data: {json.dumps({'done': True, 'citations': result.get('citations', []), 'audit_log_id': result.get('audit_log_id'), 'suggested_actions': result.get('suggested_actions', [])})}\n\n"
