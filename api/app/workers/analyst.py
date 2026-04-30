"""Analyst worker - Anthropic Sonnet 4.6. Owner: B.

Reads counterparty profile + Specter blob + similar-flags + transaction context.
Writes the markdown brief that lands in the Risk Inbox.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from ..config import settings

MODEL = "claude-sonnet-4-6"
SYSTEM = """You are a senior treasury analyst. Given a triggered risk event with full
counterparty context, write a concise brief (4-8 lines markdown) explaining what changed,
why it matters, and what action you recommend. Always end with a JSON code block:
```json
{"confidence": 0.0_to_1.0, "recommended_action": "<short imperative>"}
```
Calibrate confidence honestly: 0.85+ only when the case is open-and-shut."""


async def write_brief(event: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    """Returns a Brief dict ready to persist + publish."""
    if not settings.ANTHROPIC_API_KEY:
        return _fallback_brief(event, context)

    # TODO(B): call anthropic.AsyncAnthropic with MODEL, parse markdown body + trailing JSON.
    return _fallback_brief(event, context)


def _fallback_brief(event: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    cp = context.get("counterparty", {})
    return {
        "id": f"brief_{uuid4().hex[:8]}",
        "risk_event_id": event["id"],
        "headline": f"[FALLBACK] {event['trigger_rule']} fired on {cp.get('name', '?')}",
        "body_md": "Sonnet not configured - this is a placeholder brief. Add ANTHROPIC_API_KEY to .env.",
        "recommended_action": "Configure analyst worker.",
        "specter_snapshot": cp.get("profile_json"),
        "similar_flags": context.get("similar_flags", []),
        "model_used": "fallback",
        "tokens_in": 0,
        "tokens_out": 0,
        "latency_ms": 0,
        "created_at": datetime.now(timezone.utc),
    }
