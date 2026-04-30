"""R3 - first-ever transaction with a counterparty. Owner: B."""
from __future__ import annotations

from .base import RiskEventCandidate


class R3NewCounterparty:
    name = "R3"

    async def evaluate(self, state: dict) -> list[RiskEventCandidate]:
        out: list[RiskEventCandidate] = []
        # TODO(B): find counterparties whose first transaction occurred in the last tick window.
        # Always trigger - new counterparties get a brief by default.
        # raw_score = 0.5 baseline; analyst will refine via embeddings + Specter.
        return out
