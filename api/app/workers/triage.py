"""Triage worker — Anthropic Haiku. Owner: B."""
from __future__ import annotations

import json
import re
import time
from typing import Any

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import CounterpartyRow
from ..llm_metrics import record_tokens

MODEL = settings.ANTHROPIC_TRIAGE_MODEL
SYSTEM = """You are the triage layer in a counterparty risk system. You receive a rule
trigger and a small counterparty context. Decide if this candidate is worth a full analyst
brief. Reply ONLY with JSON: {"keep": bool, "reason": "<one sentence>"}.

Drop noise (already-flagged duplicate patterns, immaterial deltas).
Keep anything that could plausibly matter to a treasurer."""


def _extract_json(text: str) -> dict[str, Any] | None:
    text = text.strip()
    m = re.search(r"\{[^{}]*\}", text, re.DOTALL)
    if not m:
        return None
    try:
        return json.loads(m.group())
    except json.JSONDecodeError:
        return None


async def triage(
    candidate: dict[str, Any],
    counterparty_id: str,
    session: AsyncSession,
) -> dict[str, Any]:
    row = (await session.execute(select(CounterpartyRow).where(CounterpartyRow.id == counterparty_id))).scalar_one_or_none()
    name = row.name if row else counterparty_id
    profile = dict(row.profile_json) if row and row.profile_json else {}
    counterparty_brief = json.dumps(
        {"name": name, "health_tag": getattr(row, "health_tag", None), "profile_excerpt": profile},
        default=str,
    )[:12000]

    if not settings.ANTHROPIC_API_KEY:
        return {"keep": True, "reason": "fallback — no Anthropic key"}

    user_payload = json.dumps({"candidate": candidate, "counterparty": counterparty_brief}, default=str)[:14000]
    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    t0 = time.perf_counter()
    try:
        msg = await client.messages.create(
            model=MODEL,
            max_tokens=256,
            system=SYSTEM,
            messages=[{"role": "user", "content": user_payload}],
        )
    except Exception as e:
        return {"keep": True, "reason": f"triage error — default keep: {e}"}

    text = ""
    for block in msg.content:
        if block.type == "text":
            text += block.text
    parsed = _extract_json(text) or {}
    keep = bool(parsed.get("keep", True))
    reason = str(parsed.get("reason", "")) or "triage"
    usage = msg.usage
    record_tokens(MODEL, usage.input_tokens, usage.output_tokens)
    return {"keep": keep, "reason": reason, "latency_ms": int((time.perf_counter() - t0) * 1000)}
