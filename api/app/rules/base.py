"""Rule engine framework. Owner: B.

Each rule is a class with `name` and an async `evaluate(state) -> list[RiskEventCandidate]`.
The Engine ticks every N seconds, gathers candidates, hands them to the triage worker,
which decides which become real RiskEvents.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class RiskEventCandidate:
    counterparty_id: str
    trigger_rule: str
    trigger_payload: dict[str, Any] = field(default_factory=dict)
    raw_score: float = 0.0


class Rule(Protocol):
    name: str

    async def evaluate(self, state: dict) -> list[RiskEventCandidate]: ...


class RuleEngine:
    def __init__(self, rules: list[Rule], tick_seconds: float = 5.0) -> None:
        self.rules = rules
        self.tick_seconds = tick_seconds
        self._task: asyncio.Task | None = None

    async def _load_state(self) -> dict:
        # TODO(B): query DB for current snapshot the rules need
        return {}

    async def _tick(self) -> None:
        state = await self._load_state()
        candidates: list[RiskEventCandidate] = []
        for rule in self.rules:
            try:
                candidates.extend(await rule.evaluate(state))
            except Exception as e:
                print(f"[rule {rule.name}] error: {e}")
        # TODO(B): hand off to triage worker, then analyst, then persist + publish.

    async def run(self) -> None:
        while True:
            await self._tick()
            await asyncio.sleep(self.tick_seconds)

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self.run())
