from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from models.dto import ChatRequest
from services.chat import stream_chat

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(payload: ChatRequest):
    return StreamingResponse(stream_chat(payload), media_type="text/event-stream")
