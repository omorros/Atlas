"""Risk pipeline: triage → embeddings → analyst → persist + WebSocket publish."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import BriefRow, CounterpartyRow, RiskEventRow, SessionLocal
from .events import bus
from .rules.candidate import RiskEventCandidate
from .workers import analyst, embeddings, triage

logger = logging.getLogger(__name__)


async def _has_blocking_event(session: AsyncSession, rule: str, cp_id: str) -> bool:
    res = await session.scalars(
        select(RiskEventRow)
        .where(
            RiskEventRow.counterparty_id == cp_id,
            RiskEventRow.trigger_rule == rule,
            RiskEventRow.status.in_(["open", "escalated"]),
        )
        .limit(1)
    )
    return res.first() is not None


async def _build_context(session: AsyncSession, cp_id: str, candidate: RiskEventCandidate) -> dict[str, Any]:
    row = (await session.execute(select(CounterpartyRow).where(CounterpartyRow.id == cp_id))).scalar_one_or_none()
    cp = {
        "id": cp_id,
        "name": row.name if row else cp_id,
        "type": row.type if row else "?",
        "profile_json": dict(row.profile_json) if row and row.profile_json else {},
        "health_tag": row.health_tag if row else "stable",
    }
    query_parts = [cp.get("name") or ""]
    prof = cp.get("profile_json") or {}
    if prof.get("address"):
        query_parts.append(str(prof["address"]))
    tx_hint = candidate.trigger_payload.get("transaction_id") if candidate.trigger_payload else None
    if tx_hint:
        query_parts.append(str(tx_hint))
    query_text = " ".join(query_parts).strip() or (cp.get("name") or cp_id)

    similar = await embeddings.similar_flags_for_counterparty(session, cp_id, query_text)
    return {"counterparty": cp, "similar_flags": similar, "candidate": candidate}


def _route_severity(confidence: float, raw_score: float) -> str:
    if confidence >= 0.85:
        return "info"
    if confidence >= 0.5:
        return "critical" if raw_score >= 0.65 else "warn"
    return "info"


async def process_rule_candidates(candidates: list[RiskEventCandidate]) -> None:
    if not candidates:
        return

    async with SessionLocal() as session:
        for cand in candidates:
            if await _has_blocking_event(session, cand.trigger_rule, cand.counterparty_id):
                continue

            tri_in = {
                "trigger_rule": cand.trigger_rule,
                "trigger_payload": cand.trigger_payload,
                "raw_score": cand.raw_score,
            }
            tr = await triage.triage(tri_in, cand.counterparty_id, session)
            if not tr.get("keep", True):
                await session.commit()
                continue

            ctx = await _build_context(session, cand.counterparty_id, cand)

            event_id = f"re_{uuid4().hex[:12]}"
            event_stub = {
                "id": event_id,
                "counterparty_id": cand.counterparty_id,
                "trigger_rule": cand.trigger_rule,
                "trigger_payload": cand.trigger_payload,
                "raw_score": cand.raw_score,
            }

            brief_dict = await analyst.write_brief(event_stub, ctx)
            conf = float(brief_dict.get("llm_confidence", brief_dict.get("confidence", 0.75)))

            if conf < 0.5:
                logger.info(
                    "suppressed brief conf=%s rule=%s cp=%s",
                    conf,
                    cand.trigger_rule,
                    cand.counterparty_id,
                )
                await session.commit()
                continue

            severity = _route_severity(conf, cand.raw_score)
            now = datetime.now(timezone.utc)

            re_row = RiskEventRow(
                id=event_id,
                counterparty_id=cand.counterparty_id,
                trigger_rule=cand.trigger_rule,
                trigger_payload=cand.trigger_payload,
                raw_score=cand.raw_score,
                llm_confidence=conf,
                severity=severity,
                status="open",
                created_at=now,
            )
            session.add(re_row)

            brief_row = BriefRow(
                id=f"bf_{uuid4().hex[:10]}",
                risk_event_id=event_id,
                headline=brief_dict["headline"],
                body_md=brief_dict["body_md"],
                recommended_action=brief_dict.get("recommended_action", ""),
                specter_snapshot=brief_dict.get("specter_snapshot"),
                similar_flags=brief_dict.get("similar_flags", []),
                model_used=brief_dict.get("model_used", "unknown"),
                tokens_in=int(brief_dict.get("tokens_in", 0)),
                tokens_out=int(brief_dict.get("tokens_out", 0)),
                latency_ms=int(brief_dict.get("latency_ms", 0)),
                created_at=brief_dict.get("created_at", now),
            )
            session.add(brief_row)

            await session.commit()

            await bus.publish(
                {
                    "type": "risk_event_created",
                    "risk_event": {
                        "id": event_id,
                        "counterparty_id": cand.counterparty_id,
                        "trigger_rule": cand.trigger_rule,
                        "severity": severity,
                        "status": "open",
                        "llm_confidence": conf,
                        "created_at": now.isoformat(),
                    },
                }
            )
            await bus.publish(
                {
                    "type": "brief_ready",
                    "risk_event_id": event_id,
                    "brief": {
                        "id": brief_row.id,
                        "headline": brief_row.headline,
                        "model_used": brief_row.model_used,
                        "latency_ms": brief_row.latency_ms,
                        "tokens_in": brief_row.tokens_in,
                        "tokens_out": brief_row.tokens_out,
                    },
                }
            )
