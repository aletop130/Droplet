from fastapi import APIRouter, HTTPException, Query

from db.neo4j import get_database, get_driver
from services.db import (
    build_tank_balance_summary,
    build_tank_kpis_from_detail,
    fetch_segments_by_ids,
    fetch_tanks,
    get_tank_detail,
)

router = APIRouter(prefix="/api/tanks", tags=["tanks"])


@router.get("")
def list_tanks(dma: int | None = Query(default=None)):
    return fetch_tanks(dma_id=dma)


@router.get("/{tank_id}")
def get_tank(tank_id: int):
    detail = get_tank_detail(tank_id)
    if not detail:
        raise HTTPException(status_code=404, detail="tank not found")
    latest_balance = detail["balance"][0] if detail["balance"] else {"tank_id": tank_id, "flag": "unknown"}
    with get_driver() as driver:
        downstream = driver.execute_query(
            """
            MATCH (s:PipeSegment)-[:DOWNSTREAM_OF]->(t:Tank {id: $tank_id})
            RETURN s.id AS id
            ORDER BY id
            LIMIT 20
            """,
            tank_id=tank_id,
            database_=get_database(),
        ).records
    downstream_ids = [record["id"] for record in downstream]
    downstream_segments = fetch_segments_by_ids(downstream_ids)
    balance_summary = build_tank_balance_summary(tank_id, detail["state_24h"], latest_balance)
    kpis = build_tank_kpis_from_detail(detail)
    return {
        "tank": detail["tank"],
        "state_24h": detail["state_24h"],
        "balance": balance_summary,
        "balance_series": detail["balance"],
        "balance_summary": balance_summary,
        "kpi": kpis,
        "kpis": kpis,
        "anomalies": detail["anomalies"],
        "related_segments": downstream_ids,
        "downstream_segments": downstream_segments,
    }
