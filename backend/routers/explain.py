from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from services.explainer import stream_explanation

router = APIRouter(prefix="/api/explain", tags=["explain"])


@router.get("/segment/{entity_id}")
async def explain_segment(entity_id: int):
    return StreamingResponse(stream_explanation("segment", entity_id), media_type="text/event-stream")


@router.get("/tank/{entity_id}")
async def explain_tank(entity_id: int):
    return StreamingResponse(stream_explanation("tank", entity_id), media_type="text/event-stream")


@router.get("/{entity_type}/{entity_id}")
async def explain(entity_type: str, entity_id: int):
    return StreamingResponse(stream_explanation(entity_type, entity_id), media_type="text/event-stream")
