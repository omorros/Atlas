"""R3 — first-ever transaction with a counterparty (occurred in this tick window)."""
from __future__ import annotations

from typing import Any

from .candidate import RiskEventCandidate


class R3NewCounterparty:
    name = "R3"

    async def evaluate(self, state: dict[str, Any]) -> list[RiskEventCandidate]:
        out: list[RiskEventCandidate] = []
        counterparties: dict[str, dict] = state.get("counterparties") or {}
        transactions: list[dict] = state.get("transactions") or []
        tick_start = state["tick_start"]
        now = state["now"]

        first_seen: dict[str, Any] = {}
        for tx in transactions:
            cp_id = tx["counterparty_id"]
            at = tx["occurred_at"]
            if cp_id not in first_seen or at < first_seen[cp_id]:
                first_seen[cp_id] = at

        for cp_id, at in first_seen.items():
            if tick_start <= at <= now:
                cp = counterparties.get(cp_id, {})
                out.append(
                    RiskEventCandidate(
                        counterparty_id=cp_id,
                        trigger_rule=self.name,
                        trigger_payload={
                            "first_transaction_at": at.isoformat(),
                            "counterparty_name": cp.get("name"),
                        },
                        raw_score=0.5,
                    )
                )
        return out
