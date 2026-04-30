"""Rule engine framework. Owner: B."""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Protocol

from ..db import SessionLocal
from ..risk_pipeline import process_rule_candidates
from .candidate import RiskEventCandidate
from .engine_state import load_engine_state

logger = logging.getLogger(__name__)


class Rule(Protocol):
    name: str

    async def evaluate(self, state: dict) -> list[RiskEventCandidate]: ...


class RuleEngine:
    def __init__(self, rules: list[Rule], tick_seconds: float = 5.0) -> None:
        self.rules = rules
        self.tick_seconds = tick_seconds
        self._task: asyncio.Task | None = None

    async def _tick(self) -> None:
        async with SessionLocal() as session:
            state = await load_engine_state(session, self.tick_seconds)
        candidates: list[RiskEventCandidate] = []
        for rule in self.rules:
            try:
                candidates.extend(await rule.evaluate(state))
            except Exception as e:
                logger.exception("rule %s error: %s", rule.name, e)
        await process_rule_candidates(candidates)

    async def run(self) -> None:
        while True:
            await self._tick()
            await asyncio.sleep(self.tick_seconds)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self.run())
