from __future__ import annotations

import json
import time
from typing import Any, Callable

from services.agent_prompts import SYSTEM_PROMPT
from services.audit import write_ai_audit_log
from services.regolo import MODEL_ORCHESTRATOR, RegoloUnavailable, chat_completion, extract_message_content, parse_json_object
from services.tools.find_correlated_tanks import find_correlated_tanks
from services.tools.get_anomaly_breakdown import get_anomaly_breakdown
from services.tools.get_history import get_history
from services.tools.get_tank_balance import get_tank_balance
from services.tools.get_tank_kpi import get_tank_kpi
from services.tools.predict_tank_depletion import predict_tank_depletion
from services.tools.propose_control_change import propose_control_change
from services.tools.search_docs import search_docs
from services.tools.vision_annotate import vision_annotate
from services.tools.walk_network import walk_network
from services.tools.walk_tank_topology import walk_tank_topology

MAX_AGENT_LOOPS = 3


TOOL_REGISTRY: dict[str, tuple[Callable[..., Any], dict[str, Any]]] = {
    "walk_network": (
        walk_network,
        {
            "type": "function",
            "function": {
                "name": "walk_network",
                "description": "Traverse Neo4j topology around a pipe segment.",
                "parameters": {"type": "object", "properties": {"segment_id": {"type": "integer"}, "hops": {"type": "integer"}}, "required": ["segment_id"]},
            },
        },
    ),
    "search_docs": (
        search_docs,
        {
            "type": "function",
            "function": {
                "name": "search_docs",
                "description": "Search regulatory and incident documentation.",
                "parameters": {"type": "object", "properties": {"query": {"type": "string"}, "top_k": {"type": "integer"}}, "required": ["query"]},
            },
        },
    ),
    "get_history": (
        get_history,
        {
            "type": "function",
            "function": {
                "name": "get_history",
                "description": "Return historical telemetry or anomaly time series.",
                "parameters": {
                    "type": "object",
                    "properties": {"entity_type": {"type": "string"}, "entity_id": {"type": "integer"}, "window": {"type": "string"}},
                    "required": ["entity_type", "entity_id"],
                },
            },
        },
    ),
    "get_anomaly_breakdown": (
        get_anomaly_breakdown,
        {
            "type": "function",
            "function": {
                "name": "get_anomaly_breakdown",
                "description": "Return latest PHI component values for a segment.",
                "parameters": {"type": "object", "properties": {"segment_id": {"type": "integer"}}, "required": ["segment_id"]},
            },
        },
    ),
    "walk_tank_topology": (
        walk_tank_topology,
        {
            "type": "function",
            "function": {
                "name": "walk_tank_topology",
                "description": "Traverse Neo4j topology around a tank.",
                "parameters": {"type": "object", "properties": {"tank_id": {"type": "integer"}, "hops": {"type": "integer"}}, "required": ["tank_id"]},
            },
        },
    ),
    "get_tank_balance": (
        get_tank_balance,
        {
            "type": "function",
            "function": {
                "name": "get_tank_balance",
                "description": "Return latest mass-balance values for a tank.",
                "parameters": {"type": "object", "properties": {"tank_id": {"type": "integer"}, "window_hours": {"type": "integer"}}, "required": ["tank_id"]},
            },
        },
    ),
    "get_tank_kpi": (
        get_tank_kpi,
        {
            "type": "function",
            "function": {
                "name": "get_tank_kpi",
                "description": "Return KPI values for a tank.",
                "parameters": {"type": "object", "properties": {"tank_id": {"type": "integer"}}, "required": ["tank_id"]},
            },
        },
    ),
    "predict_tank_depletion": (
        predict_tank_depletion,
        {
            "type": "function",
            "function": {
                "name": "predict_tank_depletion",
                "description": "Estimate hours to empty for a tank.",
                "parameters": {"type": "object", "properties": {"tank_id": {"type": "integer"}}, "required": ["tank_id"]},
            },
        },
    ),
    "find_correlated_tanks": (
        find_correlated_tanks,
        {
            "type": "function",
            "function": {
                "name": "find_correlated_tanks",
                "description": "Find related tanks for the same signature.",
                "parameters": {"type": "object", "properties": {"tank_id": {"type": "integer"}, "signature": {"type": "string"}}, "required": ["tank_id", "signature"]},
            },
        },
    ),
    "propose_control_change": (
        propose_control_change,
        {
            "type": "function",
            "function": {
                "name": "propose_control_change",
                "description": "Write a proposed control recommendation for operator approval.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "entity_type": {"type": "string"},
                        "entity_id": {"type": "integer"},
                        "parameter": {"type": "string"},
                        "proposed_value": {"type": "number"},
                        "rationale": {"type": "string"},
                        "expected_impact": {"type": "object"},
                    },
                    "required": ["entity_type", "entity_id", "parameter", "proposed_value", "rationale", "expected_impact"],
                },
            },
        },
    ),
    "vision_annotate": (
        vision_annotate,
        {
            "type": "function",
            "function": {
                "name": "vision_annotate",
                "description": "Provide a visual annotation summary when imagery context is available.",
                "parameters": {"type": "object", "properties": {"raster_chip_url": {"type": "string"}, "question": {"type": "string"}}, "required": ["raster_chip_url", "question"]},
            },
        },
    ),
}


def _select_tool_specs(purpose: str, context: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    if purpose == "explain":
        allowed = {"walk_network", "walk_tank_topology", "get_history", "get_anomaly_breakdown", "search_docs"}
    elif purpose == "chat":
        route = (context or {}).get("route") or ""
        entity_type = (context or {}).get("entity_type") or (context or {}).get("page_context", {}).get("entity_type")
        if entity_type == "tank" or "/tank" in route:
            allowed = {"get_history", "get_tank_balance", "get_tank_kpi", "predict_tank_depletion", "search_docs"}
        elif entity_type == "segment" or "/segment" in route:
            allowed = {"get_history", "get_anomaly_breakdown", "walk_network", "search_docs"}
        else:
            allowed = set()
    else:
        allowed = set(TOOL_REGISTRY)
    return [spec for name, (_, spec) in TOOL_REGISTRY.items() if name in allowed]


def _estimate_confidence(tool_outputs: list[dict[str, Any]]) -> float:
    if not tool_outputs:
        return 0.45
    dense = sum(1 for item in tool_outputs if item.get("status") == "ok" and item.get("output"))
    failures = sum(1 for item in tool_outputs if item.get("status") != "ok")
    return round(max(0.2, min(0.93, 0.48 + dense * 0.06 - failures * 0.05)), 2)


def _parse_tool_arguments(raw_arguments: str | None) -> dict[str, Any]:
    if not raw_arguments:
        return {}
    parsed = parse_json_object(raw_arguments)
    if not isinstance(parsed, dict):
        raise ValueError("Tool arguments must be a JSON object.")
    return parsed


def _tool_error_payload(name: str, message: str, *, raw_arguments: str | None = None) -> dict[str, Any]:
    payload = {"tool": name, "status": "error", "error": message}
    if raw_arguments:
        payload["raw_arguments"] = raw_arguments
    return payload


def _fallback_answer(context: dict[str, Any] | None, tool_audit: list[dict[str, Any]]) -> str:
    route = (context or {}).get("route") or "n/d"
    successful = [item for item in tool_audit if item.get("status") == "ok"]
    failed = [item for item in tool_audit if item.get("status") != "ok"]
    citations = ", ".join(item["tool"] for item in successful[:5]) or "nessuna fonte strutturata disponibile"
    uncertainty = "Dati parziali o risposte tool non completamente interpretabili."
    if failed:
        uncertainty = f"{uncertainty} Tool con errore: {', '.join(item['tool'] for item in failed[:4])}."
    return (
        "CONTEXT\n"
        f"- Route: {route}\n"
        f"- Tool riusciti: {len(successful)}\n\n"
        "ANALYSIS\n"
        "- L'agente non ha prodotto una risposta finale completa entro il loop massimo, ma il backend e' rimasto operativo.\n\n"
        "RECOMMENDATION\n"
        "- Ripetere la richiesta o restringere il perimetro all'entita' corrente per ottenere una risposta piu' deterministica.\n\n"
        "UNCERTAINTY\n"
        f"- {uncertainty}\n\n"
        "CITATIONS\n"
        f"- {citations}"
    )


def _synthesize_final_answer(
    messages: list[dict[str, Any]],
    *,
    timing_breakdown: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    llm_started = time.perf_counter()
    response = chat_completion(
        messages=messages
        + [
            {
                "role": "system",
                "content": (
                    "Produce a final operator-ready answer now. Do not call tools again. "
                    "Use the evidence already present in the conversation and keep the required output sections."
                ),
            }
        ],
        model=MODEL_ORCHESTRATOR,
        tools=None,
        tool_choice=None,
        temperature=0.1,
    )
    timing_breakdown["llm_ms"].append(int((time.perf_counter() - llm_started) * 1000))
    content, _, usage = extract_message_content(response)
    return content, usage


def run_agent(
    *,
    user_message: str,
    purpose: str,
    context: dict[str, Any] | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    tool_audit: list[dict[str, Any]] = []
    timing_breakdown: dict[str, Any] = {"llm_ms": [], "tool_ms": []}
    tool_specs = _select_tool_specs(purpose, context)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT + f"\nContext JSON:\n{json.dumps(context or {}, ensure_ascii=False)}"},
        {"role": "user", "content": user_message},
    ]
    final_text = ""
    usage: dict[str, Any] = {}
    for loop_index in range(MAX_AGENT_LOOPS):
        llm_started = time.perf_counter()
        response = chat_completion(
            messages=messages,
            model=MODEL_ORCHESTRATOR,
            tools=tool_specs,
            tool_choice="auto" if tool_specs else None,
            temperature=0.1,
        )
        timing_breakdown["llm_ms"].append(int((time.perf_counter() - llm_started) * 1000))
        content, tool_calls, usage = extract_message_content(response)
        assistant_message: dict[str, Any] = {"role": "assistant", "content": content}
        if tool_calls:
            assistant_message["tool_calls"] = tool_calls
        messages.append(assistant_message)
        if not tool_calls:
            final_text = content
            break
        for tool_call in tool_calls:
            function_payload = tool_call.get("function") or {}
            name = function_payload.get("name") or "unknown_tool"
            raw_arguments = function_payload.get("arguments")
            if name not in TOOL_REGISTRY:
                output = _tool_error_payload(name, "Tool non registrato.", raw_arguments=raw_arguments)
                tool_audit.append({"tool": name, "input": {}, "output": output, "status": "error"})
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "name": name,
                        "content": json.dumps(output, ensure_ascii=False),
                    }
                )
                continue
            try:
                args = _parse_tool_arguments(raw_arguments)
            except Exception as exc:
                output = _tool_error_payload(name, f"Argomenti tool non validi: {exc}", raw_arguments=raw_arguments)
                tool_audit.append({"tool": name, "input": {}, "output": output, "status": "error"})
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "name": name,
                        "content": json.dumps(output, ensure_ascii=False),
                    }
                )
                continue

            fn = TOOL_REGISTRY[name][0]
            tool_started = time.perf_counter()
            try:
                output = fn(**args)
                status = "ok"
            except Exception as exc:
                output = _tool_error_payload(name, f"Errore esecuzione tool: {exc}")
                status = "error"
            elapsed_ms = int((time.perf_counter() - tool_started) * 1000)
            timing_breakdown["tool_ms"].append({"tool": name, "latency_ms": elapsed_ms, "loop": loop_index + 1})
            tool_audit.append({"tool": name, "input": args, "output": output, "status": status})
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": name,
                    "content": json.dumps(output, ensure_ascii=False),
                }
            )
    if not final_text:
        try:
            final_text, synthesis_usage = _synthesize_final_answer(messages, timing_breakdown=timing_breakdown)
            if synthesis_usage:
                usage = synthesis_usage
        except Exception:
            final_text = _fallback_answer(context, tool_audit)
    citations = []
    doc_ids = []
    graph_path: dict[str, Any] | list[Any] = {}
    for item in tool_audit:
        if item["tool"] == "search_docs" and item.get("status") == "ok":
            doc_ids.extend(doc["id"] for doc in item["output"].get("documents", []))
        if item["tool"] in {"walk_network", "walk_tank_topology"} and item.get("status") == "ok":
            graph_path = item["output"].get("graph_path") or item["output"]
    confidence = _estimate_confidence(tool_audit)
    audit_log_id = write_ai_audit_log(
        model=MODEL_ORCHESTRATOR,
        purpose=purpose,
        entity_type=entity_type,
        entity_id=entity_id,
        request_payload={"message": user_message, "context": context or {}, "session_id": session_id},
        response_text=final_text,
        confidence=confidence,
        tool_calls=tool_audit,
        retrieved_doc_ids=doc_ids,
        graph_path=graph_path,
        token_usage=usage,
        started_at=started,
    )
    if doc_ids or audit_log_id:
        citations.append({"doc_ids": doc_ids[:6], "audit_log_id": audit_log_id})
    return {
        "answer": final_text,
        "citations": citations,
        "audit_log_id": audit_log_id,
        "confidence": confidence,
        "latency_ms": int((time.perf_counter() - started) * 1000),
        "token_usage": usage,
        "tool_calls": tool_audit,
        "timing_breakdown": timing_breakdown,
        "suggested_actions": [item["output"] for item in tool_audit if item["tool"] == "propose_control_change"],
    }
