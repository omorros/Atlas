"""R2 — standing exposure: single bank holds > policy % of portfolio cash. Owner: B."""
from __future__ import annotations

from typing import Any

from .candidate import RiskEventCandidate


class R2StandingExposure:
    name = "R2"

    async def evaluate(self, state: dict[str, Any]) -> list[RiskEventCandidate]:
        out: list[RiskEventCandidate] = []
        fx: dict[str, float] = state.get("fx") or {}
        accounts: list[dict] = state.get("accounts") or []
        counterparties: dict[str, dict] = state.get("counterparties") or {}
        total = float(state.get("total_cash_usd_approx") or 0.0)
        if total <= 0:
            return out

        by_bank: dict[str, float] = {}
        for a in accounts:
            cp_id = a["counterparty_id"]
            base = float(a["balance"]) * fx.get(a["currency"], 1.0)
            by_bank[cp_id] = by_bank.get(cp_id, 0.0) + base

        for cp_id, bank_total in by_bank.items():
            cp = counterparties.get(cp_id)
            if not cp or cp.get("type") != "bank":
                continue
            pct = bank_total / total
            cap = float(cp.get("max_exposure_pct") or 1.0)
            if pct > cap:
                breach = pct - cap
                raw = min(1.0, 0.5 + breach * 2.0)
                out.append(
                    RiskEventCandidate(
                        counterparty_id=cp_id,
                        trigger_rule=self.name,
                        trigger_payload={
                            "bank_pct_of_portfolio": round(pct, 4),
                            "policy_cap_pct": cap,
                            "bank_cash_base_units": round(bank_total, 2),
                            "total_portfolio_base_units": round(total, 2),
                        },
                        raw_score=raw,
                    )
                )
        return out
