"""R1 - Specter delta. Headcount drop, failed funding, news flag. Owner: B."""
from __future__ import annotations

from .base import RiskEventCandidate


class R1SpecterDelta:
    name = "R1"

    async def evaluate(self, state: dict) -> list[RiskEventCandidate]:
        out: list[RiskEventCandidate] = []
        # TODO(B): walk counterparties, compare current profile vs last-seen profile in DB.
        # Trigger if:
        #   - profile.headcount_delta_90d_pct <= -20
        #   - profile.last_funding_round_date is older than 24 months
        #   - any news_flags contain "departure", "Layoffs", "Restructuring", "failed", "fraud"
        # raw_score scales 0-1 based on severity of the delta.
        return out
