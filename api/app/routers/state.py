"""GET /state - returns the full snapshot the frontend renders from."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import (
    AccountRow,
    BriefRow,
    CounterpartyRow,
    RiskEventRow,
    SessionLocal,
    TransactionRow,
    get_session,
)
from ..llm_metrics import get_llm_spend_usd

router = APIRouter()

_FX_BASE = {"GBP": 1.25, "EUR": 1.10, "USD": 1.00}


def _row_to_dict(row) -> dict:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}


async def assemble_metrics_dict(s: AsyncSession) -> dict:
    """Single metrics snapshot (GET /state + WS `metrics_updated`)."""
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    one_hour_ago = now_naive - timedelta(hours=1)

    accounts = [_row_to_dict(r) for r in (await s.execute(select(AccountRow))).scalars()]
    open_events = [
        _row_to_dict(r)
        for r in (
            await s.execute(select(RiskEventRow).where(RiskEventRow.status.in_(["open", "escalated"])))
        ).scalars()
    ]

    briefs_last_hour = int(
        (await s.execute(select(func.count()).select_from(BriefRow).where(BriefRow.created_at >= one_hour_ago)))
        .scalar_one()
        or 0
    )

    lookback = max(1, settings.METRICS_BURN_LOOKBACK_DAYS)
    cutoff = now_naive - timedelta(days=lookback)
    out_stmt = select(TransactionRow).where(
        TransactionRow.direction == "out",
        TransactionRow.status.in_(["posted", "queued_for_approval"]),
        TransactionRow.occurred_at >= cutoff,
    )
    out_txns = (await s.execute(out_stmt)).scalars().all()

    observed_daily = sum(float(t.amount) * _FX_BASE.get(str(t.currency), 1.0) for t in out_txns) / float(lookback)
    n_out = len(out_txns)

    llm_spend = get_llm_spend_usd()
    return _compute_metrics(
        accounts,
        open_events,
        briefs_last_hour=briefs_last_hour,
        llm_spend_usd=llm_spend,
        observed_daily_outflow_usd=observed_daily,
        outbound_txn_count=n_out,
    )


async def publish_metrics_to_ws() -> None:
    from ..events import bus

    async with SessionLocal() as session:
        metrics = await assemble_metrics_dict(session)
    await bus.publish({"type": "metrics_updated", "metrics": metrics})


@router.get("/state")
async def get_state(s: AsyncSession = Depends(get_session)) -> dict:
    counterparties = [_row_to_dict(r) for r in (await s.execute(select(CounterpartyRow))).scalars()]
    accounts = [_row_to_dict(r) for r in (await s.execute(select(AccountRow))).scalars()]

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

    metrics = await assemble_metrics_dict(s)
    return {
        "counterparties": counterparties,
        "accounts": accounts,
        "recent_transactions": txns,
        "open_risk_events": open_events,
        "recent_briefs": recent_briefs,
        "metrics": metrics,
    }


def _compute_metrics(
    accounts: list[dict],
    open_events: list[dict],
    *,
    briefs_last_hour: int,
    llm_spend_usd: float,
    observed_daily_outflow_usd: float,
    outbound_txn_count: int,
) -> dict:
    policy_daily = settings.METRICS_POLICY_DAILY_BURN_USD
    min_daily = settings.METRICS_MIN_DAILY_BURN_USD

    total_base = sum(float(a["balance"]) * _FX_BASE.get(str(a["currency"]), 1.0) for a in accounts)

    if outbound_txn_count >= 3 and observed_daily_outflow_usd > 0:
        daily_burn_calibrated = max(min_daily, observed_daily_outflow_usd)
    else:
        daily_burn_calibrated = max(min_daily, policy_daily)

    runway_months = (total_base / daily_burn_calibrated) / 30.0 if daily_burn_calibrated else 0.0

    by_provider: dict[str, float] = {}
    for a in accounts:
        bal = float(a["balance"]) * _FX_BASE.get(str(a["currency"]), 1.0)
        by_provider[str(a["counterparty_id"])] = by_provider.get(str(a["counterparty_id"]), 0.0) + bal
    largest_pct = max(by_provider.values()) / total_base if total_base > 0 else 0.0

    return {
        "total_cash_base": round(total_base, 2),
        "global_runway_months": round(runway_months, 2),
        "largest_provider_exposure_pct": round(largest_pct, 4),
        "open_critical_count": sum(1 for e in open_events if e.get("severity") == "critical"),
        "briefs_last_hour": briefs_last_hour,
        "llm_spend_usd": round(llm_spend_usd, 4),
        "daily_burn_calibrated_usd": round(daily_burn_calibrated, 2),
        "observed_daily_outflow_usd": round(observed_daily_outflow_usd, 2),
    }
