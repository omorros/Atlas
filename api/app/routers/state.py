"""GET /state - returns the full snapshot the frontend renders from."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import (
    AccountRow,
    BriefRow,
    CounterpartyRow,
    RiskEventRow,
    TransactionRow,
    get_session,
)
from ..llm_metrics import get_llm_spend_usd

router = APIRouter()


def _row_to_dict(row) -> dict:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}


@router.get("/state")
async def get_state(s: AsyncSession = Depends(get_session)) -> dict:
    counterparties = [_row_to_dict(r) for r in (await s.execute(select(CounterpartyRow))).scalars()]
    accounts = [_row_to_dict(r) for r in (await s.execute(select(AccountRow))).scalars()]

    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    txns = [
        _row_to_dict(r)
        for r in (
            await s.execute(
                select(TransactionRow).order_by(TransactionRow.occurred_at.desc()).limit(50)
            )
        ).scalars()
    ]
    open_events = [
        _row_to_dict(r)
        for r in (
            await s.execute(select(RiskEventRow).where(RiskEventRow.status.in_(["open", "escalated"])))
        ).scalars()
    ]
    recent_briefs = [
        _row_to_dict(r)
        for r in (
            await s.execute(select(BriefRow).order_by(BriefRow.created_at.desc()).limit(20))
        ).scalars()
    ]

    metrics = compute_metrics(accounts, open_events, recent_briefs, one_hour_ago)
    return {
        "counterparties": counterparties,
        "accounts": accounts,
        "recent_transactions": txns,
        "open_risk_events": open_events,
        "recent_briefs": recent_briefs,
        "metrics": metrics,
    }


def compute_metrics(
    accounts: list[dict], open_events: list[dict], briefs: list[dict], since
) -> dict:
    # Hardcoded base FX & burn for the demo. TODO(A): pull from policy.
    fx = {"GBP": 1.25, "EUR": 1.10, "USD": 1.00}
    daily_burn_base = 35000

    total_base = sum(a["balance"] * fx.get(a["currency"], 1.0) for a in accounts)
    runway_months = (total_base / daily_burn_base) / 30 if daily_burn_base else 0

    by_provider: dict[str, float] = {}
    for a in accounts:
        by_provider[a["counterparty_id"]] = by_provider.get(a["counterparty_id"], 0) + a["balance"] * fx.get(
            a["currency"], 1.0
        )
    largest_pct = max(by_provider.values()) / total_base if total_base else 0

    def _brief_recent(b: dict) -> bool:
        c = b.get("created_at")
        if c is None:
            return False
        if getattr(c, "tzinfo", None) is None:
            c = c.replace(tzinfo=timezone.utc)
        return c >= since

    return {
        "total_cash_base": round(total_base, 2),
        "global_runway_months": round(runway_months, 2),
        "largest_provider_exposure_pct": round(largest_pct, 4),
        "open_critical_count": sum(1 for e in open_events if e["severity"] == "critical"),
        "briefs_last_hour": sum(1 for b in briefs if _brief_recent(b)),
        "llm_spend_usd": get_llm_spend_usd(),
    }
