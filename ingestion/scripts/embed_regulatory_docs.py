from __future__ import annotations

import os
from typing import Iterable
from pathlib import Path

import httpx
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams


ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / "backend" / ".env")

REGOLO_API_BASE = os.environ["REGOLO_API_BASE"].rstrip("/")
REGOLO_API_KEY = os.environ["REGOLO_API_KEY"]
EMBED_MODEL = os.getenv("REGOLO_MODEL_EMBED", "Qwen3-Embedding-8B")
QDRANT_URL = os.environ["QDRANT_URL"]
QDRANT_API_KEY = os.environ["QDRANT_API_KEY"]


REGULATORY_CHUNKS = [
    "ARERA quality regulation requires operators to monitor technical quality and reduce water losses using traceable service indicators.",
    "ARERA technical quality decisions link operator performance to leakage control, continuity of service and infrastructure resilience.",
    "IWA defines Non-Revenue Water as the difference between system input volume and billed authorized consumption plus authorized unbilled uses.",
    "IWA Current Annual Real Losses and Unavoidable Annual Real Losses are the basis for Infrastructure Leakage Index evaluation.",
    "Minimum Night Flow is a standard operational signal for persistent leakage detection in district metered areas.",
    "A DMA should be hydraulically interpretable, bounded and measurable so that anomalies can be localized to a manageable service area.",
    "Pressure management is a first-line leakage mitigation control when bursts and background losses increase together.",
    "Tank level decline combined with unchanged demand can indicate leakage on downstream transmission or distribution branches.",
    "Mass balance auditing requires reconciling inflow, outflow, demand and storage variation over consistent intervals.",
    "Operator recommendations must remain human-reviewed when they change pumps, valves or pressure reducing settings in the digital twin.",
    "EU AI Act transparency obligations require traceability of model, evidence, confidence and human oversight for high-impact recommendations.",
    "A compliant audit trail should preserve prompt context, retrieved documents, graph traversal and operator action on each AI-assisted decision.",
    "Copernicus-derived thermal or vegetation stress should be treated as indirect evidence and correlated with hydraulic indicators before escalation.",
    "Leak prioritization is stronger when multiple weak signals align: subsidence, thermal anomaly, hydraulic deviation and tank imbalance.",
    "Karst-dominated source regions can show scarcity pressure even before distribution losses are repaired, requiring source and network views together.",
    "Synthetic telecontrol recommendations should express expected impact, main uncertainty and operational risk flags before approval.",
    "High NRW provinces benefit from segment-level prioritization rather than municipality averages, because hidden losses concentrate along critical mains.",
    "Reservoir and tower assets improve resilience hours and hydraulic buffering, but also create imbalance signatures when outlet losses occur.",
    "A reranker is useful in regulatory retrieval because short operational questions often map to long technical quality texts with overlapping vocabulary.",
    "Operational explainability is stronger when each cited rule is connected to the exact asset, KPI trend and topology neighborhood considered by the agent.",
    "Ciociaria pilot context: Frosinone shows very high total losses and therefore requires both tactical triage and traceable operator review.",
    "Water-loss interventions should prioritize public safety and continuity constraints before optimization of long-term capex programs.",
]

INCIDENT_CASES = [
    "Perdita probabile FD-147 DMA-2: calo di pressione notturno, aumento MNF e segnale termico positivo sul corridoio stradale.",
    "Anomalia TK-03 DMA-1: headroom sotto 35%, outflow superiore all'inflow per tre finestre consecutive.",
    "Rottura sospetta dorsale Cassino Axis: PHI 3 con contributi elevati da hydraulic e tank_signal.",
    "Scenario Ceccano Corridor: reservoir coperto stabile ma segmento a valle con deriva di pressione e evento incidente riaperto.",
    "Caso Veroli: variazione termica coerente con perdita lenta su ghisa grigia in zona urbana mista.",
    "Burst DMA-5 Frosinone South: pressione a valle ridotta, tank depletion accelerato, intervento valvola proposto ma non applicato.",
    "Anomalia pompa serbatoio sintetico TK-SYN-05-03: cicli troppo frequenti e residuo di bilancio oltre soglia.",
    "MNF elevato persistente su segmento primario: nessun picco utenza compatibile, priorità di ispezione aumentata.",
    "Incident triage source-to-tank mismatch: sorgente stabile ma serbatoio downstream in svuotamento anomalo.",
    "Evento multi-segnale Ciociaria: subsidence lieve, NDVI residuo alto, hydraulic moderato, correlazione con tank peer vicini.",
]


def embed_texts(texts: Iterable[str]) -> list[list[float]]:
    payload = {"model": EMBED_MODEL, "input": list(texts)}
    with httpx.Client(timeout=120) as client:
        response = client.post(
            f"{REGOLO_API_BASE}/embeddings",
            headers={"Authorization": f"Bearer {REGOLO_API_KEY}"},
            json=payload,
        )
        response.raise_for_status()
    data = response.json()["data"]
    return [item["embedding"] for item in data]


def ensure_collection(client: QdrantClient, name: str):
    existing = {collection.name for collection in client.get_collections().collections}
    if name in existing:
        return
    client.create_collection(
        collection_name=name,
        vectors_config=VectorParams(size=4096, distance=Distance.COSINE),
    )


def upsert_collection(client: QdrantClient, name: str, items: list[str], payload_kind: str):
    ensure_collection(client, name)
    vectors = embed_texts(items) if items else []
    points = [
        PointStruct(id=index + 1, vector=vector, payload={"kind": payload_kind, "text": text})
        for index, (text, vector) in enumerate(zip(items, vectors, strict=True))
    ]
    if points:
        client.upsert(collection_name=name, points=points, wait=True)


def main():
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    upsert_collection(client, "regulations", REGULATORY_CHUNKS, "regulation_chunk")
    upsert_collection(client, "incident_cases", INCIDENT_CASES, "incident_case")
    ensure_collection(client, "ai_decisions")

    summary = {}
    for name in ["regulations", "incident_cases", "ai_decisions"]:
        collection = client.get_collection(name)
        summary[name] = {
            "points_count": collection.points_count,
            "indexed_vectors_count": collection.indexed_vectors_count,
            "status": str(collection.status),
        }
    print(summary)


if __name__ == "__main__":
    main()
