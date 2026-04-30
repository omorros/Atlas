"""R4 - anomalous outgoing payment. Owner: B."""
from __future__ import annotations

from .base import RiskEventCandidate


class R4AnomalousPayment:
    name = "R4"

    async def evaluate(self, state: dict) -> list[RiskEventCandidate]:
        out: list[RiskEventCandidate] = []
        # TODO(B): find outgoing transactions in the last tick window where:
        #   - amount > 3 * rolling_avg(counterparty, 30d), OR
        #   - counterparty incorporated < 6 months ago
        # raw_score scales with anomaly magnitude.
        return out
