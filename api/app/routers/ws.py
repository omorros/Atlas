"""WebSocket /events/stream - fan-out from the in-process EventBus."""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..events import bus

router = APIRouter()


@router.websocket("/events/stream")
async def events_stream(ws: WebSocket) -> None:
    await ws.accept()
    q = bus.subscribe()
    try:
        # Send a hello so clients know they're connected.
        await ws.send_json({"type": "hello"})
        while True:
            event = await q.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        bus.unsubscribe(q)
