import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.alert_stream import alert_stream
from services.epanet_sim import simulation_status


router = APIRouter(tags=["alerts"])


@router.websocket("/ws/alerts")
async def alerts(websocket: WebSocket):
    await websocket.accept()
    queue = await alert_stream.subscribe()
    try:
        await websocket.send_text(json.dumps({"type": "epanet_tick", "payload": simulation_status()}))
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=25)
                await websocket.send_text(json.dumps(event))
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "epanet_tick", "payload": simulation_status()}))
    except WebSocketDisconnect:
        return
    finally:
        await alert_stream.unsubscribe(queue)
