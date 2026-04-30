"""Analyst worker — Anthropic Sonnet. Owner: B."""
from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import anthropic

from ..config import settings
from ..llm_metrics import record_tokens

MODEL = settings.ANTHROPIC_ANALYST_MODEL
SYSTEM = """You are a senior treasury analyst. Given a triggered risk event with full
counterparty context, write a concise brief (4-8 lines markdown) explaining what changed,
why it matters, and what action you recommend. Always end with a JSON code block:
```json
{"confidence": 0.0, "recommended_action": "<short imperative>"}
```
Calibrate confidence honestly: 0.85+ only when the case is open-and-shut."""


def _parse_confidence_and_body(text: str) -> tuple[str, float, str]:
    conf = 0.72
    action = "Review with treasury lead"
    body = text
    m = re.search(r"```json\s*([\s\S]*?)\s*```", text)
    if m:
        try:
            j = json.loads(m.group(1))
            conf = float(j.get("confidence", conf))
            action = str(j.get("recommended_action", action))
        except (json.JSONDecodeError, TypeError, ValueError):
            pass
        body = text[: m.start()].strip()
    return body, conf, action


async def write_brief(event: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    """Returns fields ready to persist + publish."""
    if not settings.ANTHROPIC_API_KEY:
        return _fallback_brief(event, context)

    cp = context.get("counterparty", {})
    similar = context.get("similar_flags", [])
    cand = context.get("candidate")
    trigger_payload = {}
    if cand is not None:
        trigger_payload = getattr(cand, "trigger_payload", {}) or {}
    user_obj = {
        "risk_event": event,
        "counterparty": cp,
        "similar_flags": similar,
        "trigger_payload": trigger_payload,
    }
    user_msg = json.dumps(user_obj, default=str)[:18000]

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    t0 = time.perf_counter()
    try:
        msg = await client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
    except Exception:
        return _fallback_brief(event, context)

    text = ""
    for block in msg.content:
        if block.type == "text":
            text += block.text
    body_md, confidence, rec = _parse_confidence_and_body(text)
    usage = msg.usage
    record_tokens(MODEL, usage.input_tokens, usage.output_tokens)
    lat = int((time.perf_counter() - t0) * 1000)

    return {
        "id": f"brief_{uuid4().hex[:8]}",
        "risk_event_id": event["id"],
        "headline": f"{event['trigger_rule']} — {cp.get('name', '?')}",
        "body_md": body_md or text[:2000],
        "recommended_action": rec,
        "llm_confidence": confidence,
        "confidence": confidence,
        "specter_snapshot": cp.get("profile_json"),
        "similar_flags": similar,
        "model_used": MODEL,
        "tokens_in": usage.input_tokens,
        "tokens_out": usage.output_tokens,
        "latency_ms": lat,
        "created_at": datetime.now(timezone.utc),
    }


def _fallback_brief(event: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    cp = context.get("counterparty", {})
    similar = context.get("similar_flags", [])
    return {
        "id": f"brief_{uuid4().hex[:8]}",
        "risk_event_id": event["id"],
        "headline": f"[FALLBACK] {event['trigger_rule']} — {cp.get('name', '?')}",
        "body_md": (
            "Analyst not configured or request failed — placeholder brief.\n\n"
            "Add **ANTHROPIC_API_KEY** to `api/.env` for live Sonnet briefs."
        ),
        "recommended_action": "Verify API keys and retry.",
        "llm_confidence": 0.72,
        "confidence": 0.72,
        "specter_snapshot": cp.get("profile_json"),
        "similar_flags": similar,
        "model_used": "fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "latency_ms": 0,
        "created_at": datetime.now(timezone.utc),
    }
