"""POST /risk-events/:id/{escalate|dismiss|resolve|investigate}"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import RiskEventRow, get_session
from ..events import bus

router = APIRouter(prefix="/risk-events")


async def _set_status(event_id: str, status: str, s: AsyncSession) -> dict:
    re = (await s.execute(select(RiskEventRow).where(RiskEventRow.id == event_id))).scalar_one_or_none()
    if not re:
        raise HTTPException(404, "risk event not found")
    re.status = status
    await s.commit()
    payload = {"id": re.id, "status": re.status, "counterparty_id": re.counterparty_id}
    await bus.publish({"type": "risk_event_created", "risk_event": payload})
    return {"ok": True, "risk_event": payload}


@router.post("/{event_id}/escalate")
async def escalate(event_id: str, s: AsyncSession = Depends(get_session)) -> dict:
    return await _set_status(event_id, "escalated", s)


@router.post("/{event_id}/dismiss")
async def dismiss(event_id: str, s: AsyncSession = Depends(get_session)) -> dict:
    return await _set_status(event_id, "dismissed", s)


@router.post("/{event_id}/resolve")
async def resolve(event_id: str, s: AsyncSession = Depends(get_session)) -> dict:
    return await _set_status(event_id, "resolved", s)


@router.post("/{event_id}/investigate")
async def investigate(event_id: str, s: AsyncSession = Depends(get_session)) -> dict:
    """Forward to the Node sidecar which spawns a Cursor Cloud Agent."""
    re = (await s.execute(select(RiskEventRow).where(RiskEventRow.id == event_id))).scalar_one_or_none()
    if not re:
        raise HTTPException(404, "risk event not found")

    # TODO(D): include the Brief + Specter blob + a small toolkit description
    body = {"risk_event_id": re.id, "counterparty_id": re.counterparty_id}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(f"{settings.SIDECAR_URL}/investigate", json=body)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        raise HTTPException(502, f"sidecar unreachable: {e}") from e
