from __future__ import annotations

import time
from typing import Any

import httpx

from db.qdrant import get_qdrant_client
from services.regolo import embed_texts, rerank

DOC_SEARCH_CACHE_TTL_S = 900
_DOC_SEARCH_CACHE: dict[tuple[str, int], tuple[float, dict[str, Any]]] = {}


def _normalize_query(query: str) -> str:
    return " ".join(query.lower().split())


def _get_cached(query: str, top_k: int) -> dict[str, Any] | None:
    cached = _DOC_SEARCH_CACHE.get((_normalize_query(query), top_k))
    if not cached:
        return None
    expires_at, payload = cached
    if expires_at <= time.time():
        _DOC_SEARCH_CACHE.pop((_normalize_query(query), top_k), None)
        return None
    return payload


def _set_cached(query: str, top_k: int, payload: dict[str, Any]) -> dict[str, Any]:
    _DOC_SEARCH_CACHE[(_normalize_query(query), top_k)] = (time.time() + DOC_SEARCH_CACHE_TTL_S, payload)
    return payload


def search_docs(query: str, filter: dict | None = None, top_k: int = 5) -> dict:
    cached = _get_cached(query, top_k)
    if cached is not None:
        return cached

    client = get_qdrant_client()
    embedding = embed_texts([query])[0]
    points = client.query_points(
        collection_name="regulations",
        query=embedding,
        limit=max(top_k * 2, top_k + 3),
        with_payload=True,
    ).points
    docs = []
    for point in points:
        payload = point.payload or {}
        text = str(payload.get("text") or "")
        lexical_bonus = 0.08 if any(token.lower() in text.lower() for token in query.split()) else 0.0
        docs.append(
            {
                "id": f"regulations-{point.id}",
                "title": text[:96],
                "url": "https://www.arera.it",
                "score": float(point.score or 0.0) + lexical_bonus,
                "text": text,
            }
        )
    use_rerank = bool(docs) and not (
        len(docs) <= top_k and max((doc["score"] for doc in docs), default=0.0) >= 0.92
    )
    reranked = []
    if use_rerank:
        try:
            reranked = rerank(
                query,
                [doc["text"] for doc in docs],
                timeout=httpx.Timeout(connect=2.0, read=4.0, write=4.0, pool=4.0),
            )
        except Exception:
            reranked = []
    rerank_scores = {item["index"]: float(item["relevance_score"]) for item in reranked if "index" in item}
    for index, doc in enumerate(docs):
        if rerank_scores:
            doc["score"] = round((doc["score"] * 0.45) + (rerank_scores.get(index, 0.0) * 0.55), 6)
        else:
            doc["score"] = round(doc["score"], 6)
    docs.sort(key=lambda item: item["score"], reverse=True)
    return _set_cached(
        query,
        top_k,
        {"query": query, "filter": filter or {}, "top_k": top_k, "documents": docs[:top_k]},
    )
