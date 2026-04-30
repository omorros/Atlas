"""Rough cumulative LLM spend estimate for /state metrics. Owner: B."""
from __future__ import annotations

import threading

_lock = threading.Lock()
_usd: float = 0.0

# Approximate $ / 1M tokens (input / output) — order-of-magnitude for demo meter.
_RATES: dict[str, tuple[float, float]] = {
    "claude-3-5-haiku-20241022": (1.0, 5.0),
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "claude-sonnet-4-20250514": (3.0, 15.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-sonnet-4-6-20250514": (3.0, 15.0),
    "fallback": (0.0, 0.0),
    "text-embedding-3-large": (0.13, 0.0),
}


def record_tokens(model: str, tokens_in: int, tokens_out: int) -> None:
    global _usd
    rin, rout = _RATES.get(model, (3.0, 15.0))
    cost = (tokens_in / 1_000_000.0) * rin + (tokens_out / 1_000_000.0) * rout
    if cost <= 0 and model.startswith("text-embedding"):
        cost = (tokens_in / 1_000_000.0) * _RATES["text-embedding-3-large"][0]
    with _lock:
        _usd += cost


def get_llm_spend_usd() -> float:
    with _lock:
        return round(_usd, 4)
