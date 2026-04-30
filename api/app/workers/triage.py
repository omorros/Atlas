"""Triage worker - Anthropic Haiku 4.5. Owner: B.

Cheap per-event filter. Drops noise candidates before the expensive analyst runs.
"""
from __future__ import annotations

from typing import Any

from ..config import settings

MODEL = "claude-haiku-4-5-20251001"
SYSTEM = """You are the triage layer in a counterparty risk system. You receive a rule
trigger and a small counterparty context. Decide if this candidate is worth a full analyst
brief. Reply ONLY with JSON: {"keep": bool, "reason": "<one sentence>"}.

Drop noise (already-flagged, duplicate of recent event, immaterial delta).
Keep anything that could plausibly matter to a treasurer."""


async def triage(candidate: dict[str, Any], counterparty_brief: str) -> dict[str, Any]:
    """Returns {'keep': bool, 'reason': str}. Falls back to keep=True if no API key."""
    if not settings.ANTHROPIC_API_KEY:
        return {"keep": True, "reason": "fallback - no Anthropic key"}

    # TODO(B): call anthropic.AsyncAnthropic with MODEL, system=SYSTEM, parse JSON output.
    # Track tokens + latency, return alongside the keep/reason for the metrics meter.
    return {"keep": True, "reason": "TODO wire Haiku call"}
