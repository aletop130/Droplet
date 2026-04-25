from __future__ import annotations

import ast
import json
import os
import re
from typing import Any, AsyncIterator

import httpx
from dotenv import load_dotenv


load_dotenv()

REGOLO_API_BASE = os.getenv("REGOLO_API_BASE", "https://api.regolo.ai/v1").rstrip("/")
REGOLO_API_KEY = os.getenv("REGOLO_API_KEY", "")
MODEL_ORCHESTRATOR = os.getenv("REGOLO_MODEL_ORCHESTRATOR", "gpt-oss-120b")
MODEL_VL = os.getenv("REGOLO_MODEL_VL", "qwen3.6-27b")
MODEL_EMBED = os.getenv("REGOLO_MODEL_EMBED", "Qwen3-Embedding-8B")
MODEL_RERANK = os.getenv("REGOLO_MODEL_RERANK", "Qwen3-Reranker-4B")
MODEL_CHAT = os.getenv("REGOLO_MODEL_CHATBOT", "brick-v1-beta")
DEFAULT_CONNECT_TIMEOUT_S = float(os.getenv("REGOLO_CONNECT_TIMEOUT_S", "3.0"))
DEFAULT_READ_TIMEOUT_S = float(os.getenv("REGOLO_READ_TIMEOUT_S", "25.0"))
DEFAULT_WRITE_TIMEOUT_S = float(os.getenv("REGOLO_WRITE_TIMEOUT_S", "20.0"))
DEFAULT_POOL_TIMEOUT_S = float(os.getenv("REGOLO_POOL_TIMEOUT_S", "10.0"))


class RegoloUnavailable(RuntimeError):
    pass


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {REGOLO_API_KEY}", "Content-Type": "application/json"}


def _timeout(
    *,
    connect: float = DEFAULT_CONNECT_TIMEOUT_S,
    read: float = DEFAULT_READ_TIMEOUT_S,
    write: float = DEFAULT_WRITE_TIMEOUT_S,
    pool: float = DEFAULT_POOL_TIMEOUT_S,
) -> httpx.Timeout:
    return httpx.Timeout(connect=connect, read=read, write=write, pool=pool)


def chat_completion(
    *,
    messages: list[dict[str, Any]],
    model: str = MODEL_ORCHESTRATOR,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | dict[str, Any] | None = None,
    temperature: float = 0.1,
    timeout: httpx.Timeout | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature}
    if tools:
        payload["tools"] = tools
    if tool_choice is not None:
        payload["tool_choice"] = tool_choice
    try:
        with httpx.Client(timeout=timeout or _timeout()) as client:
            response = client.post(f"{REGOLO_API_BASE}/chat/completions", headers=_headers(), json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as exc:
        raise RegoloUnavailable(str(exc)) from exc


async def stream_chat_completion(
    *,
    messages: list[dict[str, Any]],
    model: str = MODEL_ORCHESTRATOR,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | dict[str, Any] | None = None,
    temperature: float = 0.1,
    timeout: httpx.Timeout | None = None,
) -> AsyncIterator[str]:
    payload: dict[str, Any] = {"model": model, "messages": messages, "temperature": temperature, "stream": True}
    if tools:
        payload["tools"] = tools
    if tool_choice is not None:
        payload["tool_choice"] = tool_choice
    try:
        async with httpx.AsyncClient(timeout=timeout or _timeout(read=60.0)) as client:
            async with client.stream("POST", f"{REGOLO_API_BASE}/chat/completions", headers=_headers(), json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    for choice in event.get("choices") or []:
                        delta = choice.get("delta") or choice.get("message") or {}
                        content = delta.get("content")
                        if isinstance(content, str) and content:
                            yield content
                        elif isinstance(content, list):
                            for part in content:
                                if isinstance(part, dict) and isinstance(part.get("text"), str):
                                    yield part["text"]
    except httpx.HTTPError as exc:
        raise RegoloUnavailable(str(exc)) from exc


def embed_texts(texts: list[str], model: str = MODEL_EMBED, timeout: httpx.Timeout | None = None) -> list[list[float]]:
    try:
        with httpx.Client(timeout=timeout or _timeout(read=8.0, write=10.0)) as client:
            response = client.post(
                f"{REGOLO_API_BASE}/embeddings",
                headers=_headers(),
                json={"model": model, "input": texts},
            )
            response.raise_for_status()
            data = response.json()["data"]
            return [item["embedding"] for item in data]
    except httpx.HTTPError as exc:
        raise RegoloUnavailable(str(exc)) from exc


def rerank(
    query: str,
    documents: list[str],
    model: str = MODEL_RERANK,
    timeout: httpx.Timeout | None = None,
) -> list[dict[str, Any]]:
    try:
        with httpx.Client(timeout=timeout or _timeout(read=10.0, write=10.0)) as client:
            response = client.post(
                f"{REGOLO_API_BASE}/rerank",
                headers=_headers(),
                json={"model": model, "query": query, "documents": documents},
            )
            response.raise_for_status()
            return response.json().get("results", [])
    except httpx.HTTPError as exc:
        raise RegoloUnavailable(str(exc)) from exc


def extract_message_content(response: dict[str, Any]) -> tuple[str, list[dict[str, Any]], dict[str, Any]]:
    choice = response["choices"][0]["message"]
    content = choice.get("content") or ""
    tool_calls = choice.get("tool_calls") or []
    usage = response.get("usage") or {}
    return content, tool_calls, usage


def parse_json_object(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[1]
        stripped = stripped.rsplit("```", 1)[0]
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", stripped, re.DOTALL)
    candidate = match.group(0) if match else stripped
    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    sanitized = re.sub(r",\s*([}\]])", r"\1", candidate)
    normalized = re.sub(r"\bNone\b", "null", sanitized)
    normalized = re.sub(r"\bTrue\b", "true", normalized)
    normalized = re.sub(r"\bFalse\b", "false", normalized)
    try:
        parsed = json.loads(normalized)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    try:
        parsed = ast.literal_eval(sanitized)
        if isinstance(parsed, dict):
            return parsed
    except (SyntaxError, ValueError):
        pass

    raise json.JSONDecodeError("Unable to parse JSON object", candidate, 0)
