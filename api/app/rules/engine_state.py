"""Load a snapshot dict shared by all rules (risk engine)."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import AccountRow, CounterpartyRow, TransactionRow


def load_policy_fx() -> dict[str, float]:
    try:
        with open(settings.FIXTURES_PATH) as f:
            fx = json.load(f).get("policy", {}).get("base_fx_rates", {})
        return {str(k): float(v) for k, v in fx.items()}
    except Exception:
        return {"GBP": 1.25, "EUR": 1.10, "USD": 1.00}


async def load_engine_state(session: AsyncSession, tick_seconds: float) -> dict[str, Any]:
    """Build the rule engine snapshot."""
    now = datetime.now(timezone.utc)
    tick_start = now - timedelta(seconds=tick_seconds)

    cp_rows = (await session.execute(select(CounterpartyRow))).scalars().all()
    counterparties: dict[str, dict[str, Any]] = {}
    for row in cp_rows:
        counterparties[row.id] = {
            "id": row.id,
            "name": row.name,
            "type": row.type,
            "provider": row.provider,
            "region": row.region,
            "lat": row.lat,
            "lng": row.lng,
            "specter_id": row.specter_id,
            "profile_json": dict(row.profile_json) if row.profile_json else {},
            "embedding": row.embedding,
            "health_tag": row.health_tag or "stable",
            "max_exposure_pct": float(row.max_exposure_pct or 1.0),
        }

    acc_rows = (await session.execute(select(AccountRow))).scalars().all()
    accounts = [
        {
            "id": r.id,
            "counterparty_id": r.counterparty_id,
            "name": r.name,
            "currency": r.currency,
            "balance": float(r.balance),
            "region": r.region,
        }
        for r in acc_rows
    ]

    tx_rows = (
        await session.execute(select(TransactionRow).order_by(TransactionRow.occurred_at.asc()))
    ).scalars().all()
    transactions: list[dict[str, Any]] = []
    for r in tx_rows:
        at = r.occurred_at
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        transactions.append(
            {
                "id": r.id,
                "direction": r.direction,
                "counterparty_id": r.counterparty_id,
                "account_id": r.account_id,
                "amount": float(r.amount),
                "currency": r.currency,
                "status": r.status,
                "description": r.description or "",
                "occurred_at": at,
            }
        )

    fx = load_policy_fx()
    total_cash = sum(a["balance"] * fx.get(a["currency"], 1.0) for a in accounts)

    return {
        "now": now,
        "tick_seconds": tick_seconds,
        "tick_start": tick_start,
        "counterparties": counterparties,
        "accounts": accounts,
        "transactions": transactions,
        "fx": fx,
        "total_cash_usd_approx": total_cash,
    }
