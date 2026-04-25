from fastapi import APIRouter, HTTPException, Query

from services.db import fetch_segments, get_segment_detail, get_segment_history

router = APIRouter(prefix="/api/segments", tags=["segments"])


@router.get("")
def list_segments(dma: int | None = Query(default=None), bbox: str | None = None):
    return fetch_segments(dma_id=dma, bbox=bbox)


@router.get("/{segment_id}")
def get_segment(segment_id: int):
    detail = get_segment_detail(segment_id)
    if not detail:
        raise HTTPException(status_code=404, detail="segment not found")
    props = detail["segment"]["properties"]
    return {
        "segment": detail["segment"],
        "scores": {key: props[key] for key in ["subsidence", "ndvi", "thermal", "hydraulic", "tank_signal", "phi"]},
        "history": get_segment_history(segment_id, days=90),
        "incidents": detail["incidents"],
    }
