"""R4 — anomalous outgoing payment vs 30d rolling average or very young counterparty."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from .candidate import RiskEventCandidate


def _parse_inc(inc: str) -> datetime | None:
    try:
        raw = str(inc).strip()
        if "T" in raw:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        dt = datetime.fromisoformat(raw)
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:
        return None


class R4AnomalousPayment:
    name = "R4"

    def _young_months(self, profile: dict, ref: datetime) -> float | None:
        inc = profile.get("incorporated")
        if not inc:
            return None
        dt = _parse_inc(str(inc))
        if not dt:
            return None
        return (ref - dt).days / 30.44

    async def evaluate(self, state: dict[str, Any]) -> list[RiskEventCandidate]:
        out: list[RiskEventCandidate] = []
        counterparties: dict[str, dict] = state.get("counterparties") or {}
        transactions: list[dict] = state.get("transactions") or []
        tick_start = state["tick_start"]
        now = state["now"]
        fx: dict[str, float] = state.get("fx") or {}

        window_tx = [
            t
            for t in transactions
            if t["direction"] == "out"
            and t["status"] in ("posted", "queued_for_approval", "scheduled")
            and tick_start <= t["occurred_at"] <= now
        ]

        for tx in window_tx:
            cp_id = tx["counterparty_id"]
            cp = counterparties.get(cp_id, {})
            profile = cp.get("profile_json") or {}
            at = tx["occurred_at"]
            cutoff = at - timedelta(days=30)

            historical = [
                x
                for x in transactions
                if x["counterparty_id"] == cp_id
                and x["direction"] == "out"
                and x["id"] != tx["id"]
                and cutoff <= x["occurred_at"] < at
            ]

            amounts_base = []
            for x in historical:
                amounts_base.append(float(x["amount"]) * fx.get(x["currency"], 1.0))
            avg = sum(amounts_base) / len(amounts_base) if amounts_base else 0.0
            amt_base = float(tx["amount"]) * fx.get(tx["currency"], 1.0)

            anomaly_ratio = (amt_base / avg) if avg > 0 else 999.0 if amt_base > 0 else 0.0
            young_m = self._young_months(profile, at)
            young = young_m is not None and young_m < 6.0

            reasons: dict[str, Any] = {}
            raw = 0.0
            if avg > 0 and amt_base > 3 * avg:
                reasons["vs_30d_avg"] = round(anomaly_ratio, 2)
                raw = max(raw, min(1.0, 0.5 + min(0.45, (anomaly_ratio - 3) / 10.0)))
            if young:
                reasons["counterparty_age_months"] = round(young_m or 0.0, 2)
                raw = max(raw, min(1.0, 0.55 + (6.0 - (young_m or 0)) * 0.05))

            if raw <= 0:
                continue

            reasons["transaction_id"] = tx["id"]
            reasons["amount_base_units"] = round(amt_base, 2)
            out.append(
                RiskEventCandidate(
                    counterparty_id=cp_id,
                    trigger_rule=self.name,
                    trigger_payload=reasons,
                    raw_score=raw,
                )
            )
        return out
