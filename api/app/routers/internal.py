"""Internal integration endpoints used by the Node sidecar."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import InvestigationRow, get_session
from ..events import bus

router = APIRouter(prefix="/internal")


class InvestigationEventIn(BaseModel):
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    ts: datetime | None = None


class InvestigationEventEnvelope(BaseModel):
    investigation_id: str
    risk_event_id: str | None = None
    cursor_agent_id: str | None = None
    status: str | None = None
    event: InvestigationEventIn


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _event_dict(event: InvestigationEventIn) -> dict[str, Any]:
    ts = event.ts or _now()
    return {
        "type": event.type,
        "payload": dict(event.payload),
        "ts": ts.isoformat(),
    }


def _sanitize_artifact_payload(payload: dict[str, Any], investigation_id: str) -> dict[str, Any]:
    if "path" not in payload:
        return payload
    path = str(payload["path"])
    clean = {k: v for k, v in payload.items() if k != "content"}
    clean.setdefault("mime", "application/octet-stream")
    clean["url"] = f"/internal/investigations/{investigation_id}/artifacts/{path}"
    return clean


@router.post("/investigation-events")
async def receive_investigation_event(
    envelope: InvestigationEventEnvelope,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if settings.INTERNAL_TOKEN and x_internal_token != settings.INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal token")

    row = (
        await session.execute(
            select(InvestigationRow).where(InvestigationRow.id == envelope.investigation_id)
        )
    ).scalar_one_or_none()

    if not row:
        if not envelope.risk_event_id:
            raise HTTPException(400, "risk_event_id required for first investigation event")
        row = InvestigationRow(
            id=envelope.investigation_id,
            risk_event_id=envelope.risk_event_id,
            cursor_agent_id=envelope.cursor_agent_id,
            status="running",
            events=[],
            artifacts=[],
            created_at=_now(),
        )
        session.add(row)

    if envelope.cursor_agent_id and not row.cursor_agent_id:
        row.cursor_agent_id = envelope.cursor_agent_id
    if envelope.status:
        row.status = envelope.status
        if envelope.status in {"finished", "error", "cancelled"}:
            row.finished_at = _now()
            if row.created_at:
                row.duration_ms = int((row.finished_at - _aware(row.created_at)).total_seconds() * 1000)

    event = _event_dict(envelope.event)
    if event["type"] == "artifact":
        event["payload"] = _sanitize_artifact_payload(event["payload"], envelope.investigation_id)
        artifact = dict(event["payload"])
        raw_content = envelope.event.payload.get("content")
        if raw_content is not None:
            artifact["content"] = raw_content
        artifacts = list(row.artifacts or [])
        artifacts.append(artifact)
        row.artifacts = artifacts

    events = list(row.events or [])
    events.append(event)
    row.events = events
    await session.commit()

    await bus.publish(
        {
            "type": "investigation_event",
            "investigation_id": envelope.investigation_id,
            "event": event,
        }
    )
    return {"ok": True}


@router.get("/investigations/{investigation_id}/artifacts/{artifact_path:path}")
async def download_artifact(
    investigation_id: str,
    artifact_path: str,
    session: AsyncSession = Depends(get_session),
) -> Response:
    row = (
        await session.execute(select(InvestigationRow).where(InvestigationRow.id == investigation_id))
    ).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "investigation not found")

    for artifact in row.artifacts or []:
        if artifact.get("path") == artifact_path and "content" in artifact:
            mime = str(artifact.get("mime") or "application/octet-stream")
            return Response(content=str(artifact["content"]), media_type=mime)
    raise HTTPException(404, "artifact not found")
