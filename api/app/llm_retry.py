"""Retry outbound LLM HTTP/API calls on rate limits with exponential backoff + jitter.

P3: wrap Anthropic / OpenAI calls:
    result = await call_with_rate_limit_retry(lambda: client.messages.create(...))

For async factories that need no args, pass `lambda: coro` only if coro is awaitable from sync lambda — prefer:
    async def invoke():
        return await anthropic_client.messages.create(...)
    return await call_with_rate_limit_retry(invoke)
"""
from __future__ import annotations

import asyncio
import random
from collections.abc import Awaitable, Callable
from typing import TypeVar

T = TypeVar("T")

DEFAULT_MAX_ATTEMPTS = 6
INITIAL_DELAY_S = 1.0
MAX_DELAY_S = 90.0


def _is_rate_limit(exc: BaseException) -> bool:
    code = getattr(exc, "status_code", None)
    if code == 429:
        return True
    response = getattr(exc, "response", None)
    if response is not None:
        sc = getattr(response, "status_code", None)
        if sc == 429:
            return True
    err_type = type(exc).__name__.lower()
    if "ratelimit" in err_type or "rate_limit" in err_type:
        return True
    s = str(exc).lower()
    return "429" in s or "too many requests" in s or "rate limit" in s


async def call_with_rate_limit_retry(
    fn: Callable[[], Awaitable[T]],
    *,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    initial_delay_s: float = INITIAL_DELAY_S,
    max_delay_s: float = MAX_DELAY_S,
) -> T:
    delay = initial_delay_s
    last: BaseException | None = None
    for attempt in range(max_attempts):
        try:
            return await fn()
        except BaseException as e:
            last = e
            if not _is_rate_limit(e) or attempt >= max_attempts - 1:
                raise
            jitter = random.uniform(0, delay * 0.2)
            await asyncio.sleep(min(delay + jitter, max_delay_s))
            delay = min(delay * 2, max_delay_s)
    assert last is not None
    raise last
