from fastapi import APIRouter
from fastapi import Query

from services.db import fetch_network_topology, list_network_areas

router = APIRouter(prefix="/api/network", tags=["network"])


@router.get("/graph")
def get_network_graph(area_id: int | None = Query(default=None)):
    return fetch_network_topology(dma_id=area_id)


@router.get("/areas")
def get_network_areas():
    return {"items": list_network_areas()}
