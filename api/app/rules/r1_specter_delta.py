"""R1 — Specter delta: headcount shock, stale funding, negative news."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .candidate import RiskEventCandidate


def _parse_date(s: str) -> datetime | None:
    try:
        raw = str(s).strip()
        if "T" in raw:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return datetime.fromisoformat(raw).replace(tzinfo=timezone.utc)
    except Exception:
        return None


_NEWS_KEYS = (
    "departure",
    "layoff",
    "restructuring",
    "failed",
    "fraud",
    "downgrade",
    "bankrupt",
    "default",
)


class R1SpecterDelta:
    name = "R1"

    def _score_profile(self, profile: dict[str, Any], now: datetime) -> tuple[float, dict[str, Any]]:
        reasons: dict[str, Any] = {}
        score = 0.0

        hc = profile.get("headcount_delta_90d_pct")
        if hc is not None and float(hc) <= -20.0:
            reasons["headcount_delta_90d_pct"] = hc
            score = max(score, min(1.0, 0.4 + abs(float(hc)) / 100.0))

        funding_date = profile.get("last_funding_round_date")
        if funding_date:
            fd = _parse_date(str(funding_date))
            if fd:
                if fd.tzinfo is None:
                    fd = fd.replace(tzinfo=timezone.utc)
                months = (now - fd).days / 30.44
                if months > 24:
                    reasons["months_since_funding"] = round(months, 1)
                    score = max(score, min(1.0, 0.35 + min(0.4, (months - 24) / 60.0)))

        flags = profile.get("news_flags") or []
        joined = " ".join(str(x) for x in flags).lower()
        hits = [k for k in _NEWS_KEYS if k in joined]
        if hits:
            reasons["news_hits"] = hits
            score = max(score, min(1.0, 0.45 + 0.1 * len(hits)))

        return score, reasons

    async def evaluate(self, state: dict[str, Any]) -> list[RiskEventCandidate]:
        out: list[RiskEventCandidate] = []
        now = state.get("now") or datetime.now(timezone.utc)
        counterparties: dict[str, dict] = state.get("counterparties") or {}

        for cp_id, cp in counterparties.items():
            profile = cp.get("profile_json") or {}
            if not profile:
                continue
            raw, reasons = self._score_profile(profile, now)
            if raw <= 0:
                continue
            out.append(
                RiskEventCandidate(
                    counterparty_id=cp_id,
                    trigger_rule=self.name,
                    trigger_payload={"signals": reasons, "specter_excerpt": profile},
                    raw_score=raw,
                )
            )
        return out
