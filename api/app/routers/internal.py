"""Internal routes for agent-svc and other backends. Owner: P2."""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..events import bus

router = APIRouter(prefix="/internal")


class InvestigationEventIn(BaseModel):
    investigation_id: str
    event: dict


@router.post("/investigation-events")
async def post_investigation_event(
    body: InvestigationEventIn,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> dict:
    """Forward sidecar investigation stream events to WebSocket clients."""
    if settings.INTERNAL_TOKEN:
        if x_internal_token != settings.INTERNAL_TOKEN:
            raise HTTPException(status_code=401, detail="Invalid internal token")
    await bus.publish({
        "type": "investigation_event",
        "investigation_id": body.investigation_id,
        "event": body.event,
    })
    return {"ok": True}
