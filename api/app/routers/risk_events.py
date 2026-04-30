"""POST /risk-events/:id/{escalate|dismiss|resolve|investigate}"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import BriefRow, CounterpartyRow, RiskEventRow, get_session
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

    cp = (
        await s.execute(select(CounterpartyRow).where(CounterpartyRow.id == re.counterparty_id))
    ).scalar_one_or_none()
    brief = (
        await s.execute(
            select(BriefRow)
            .where(BriefRow.risk_event_id == re.id)
            .order_by(BriefRow.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    body = {
        "risk_event_id": re.id,
        "counterparty_id": re.counterparty_id,
        "risk_event": {
            "id": re.id,
            "counterparty_id": re.counterparty_id,
            "trigger_rule": re.trigger_rule,
            "trigger_payload": re.trigger_payload,
            "raw_score": re.raw_score,
            "llm_confidence": re.llm_confidence,
            "severity": re.severity,
            "status": re.status,
            "created_at": re.created_at.isoformat(),
        },
        "counterparty": {
            "id": cp.id,
            "name": cp.name,
            "type": cp.type,
            "region": cp.region,
            "specter_id": cp.specter_id,
            "health_tag": cp.health_tag,
            "profile_json": cp.profile_json,
        }
        if cp
        else None,
        "brief": {
            "id": brief.id,
            "headline": brief.headline,
            "body_md": brief.body_md,
            "recommended_action": brief.recommended_action,
            "specter_snapshot": brief.specter_snapshot,
            "similar_flags": brief.similar_flags,
            "model_used": brief.model_used,
        }
        if brief
        else None,
        "toolkit": {
            "specter": "Use Specter profile data already provided; request follow-up lookup only if it changes the memo.",
            "artifact": "Return a concise memo artifact named memo.md.",
        },
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(f"{settings.SIDECAR_URL}/investigate", json=body)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        raise HTTPException(502, f"sidecar unreachable: {e}") from e
