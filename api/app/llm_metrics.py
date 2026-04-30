"""Rough cumulative LLM spend estimate for GET /state metrics."""
from __future__ import annotations

import asyncio
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


def reset_llm_spend_usd() -> None:
    global _usd
    with _lock:
        _usd = 0.0


def _schedule_metrics_broadcast() -> None:
    try:
        from .routers.state import publish_metrics_to_ws

        loop = asyncio.get_running_loop()
        loop.create_task(publish_metrics_to_ws())
    except RuntimeError:
        pass


def record_tokens(model: str, tokens_in: int, tokens_out: int) -> None:
    global _usd
    rin, rout = _RATES.get(model, (3.0, 15.0))
    cost = (tokens_in / 1_000_000.0) * rin + (tokens_out / 1_000_000.0) * rout
    if cost <= 0 and model.startswith("text-embedding"):
        cost = (tokens_in / 1_000_000.0) * _RATES["text-embedding-3-large"][0]
    with _lock:
        _usd += cost
    _schedule_metrics_broadcast()


def get_llm_spend_usd() -> float:
    with _lock:
        return round(_usd, 4)
