"""POST /demo/trigger/* - the three buttons in the demo dock."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import CounterpartyRow, TransactionRow, get_session
from ..events import bus
from ..llm_metrics import reset_llm_spend_usd
from ..routers.state import publish_metrics_to_ws
from ..seed import truncate_and_seed

router = APIRouter(prefix="/demo")


@router.post("/reset")
async def demo_reset() -> dict:
    """Wipe DB + reseed fixtures and reset cumulative LLM spend (repeatable demos)."""
    if not settings.DEMO_RESET_ENABLED:
        raise HTTPException(status_code=403, detail="Demo reset disabled (set DEMO_RESET_ENABLED=1)")
    await truncate_and_seed()
    reset_llm_spend_usd()
    await publish_metrics_to_ws()
    return {"ok": True}


@router.post("/trigger/bank-downgrade")
async def trigger_bank_downgrade(s: AsyncSession = Depends(get_session)) -> dict:
    """Beat 1: flip Neobank X to fragile. Should fire R1 in the rule engine."""
    cp = (await s.execute(select(CounterpartyRow).where(CounterpartyRow.id == "cp_neobank_x"))).scalar_one_or_none()
    if not cp:
        raise HTTPException(404, "Neobank X not seeded")

    cp.health_tag = "fragile"
    profile = dict(cp.profile_json or {})
    profile["headcount_delta_90d_pct"] = -32
    profile.setdefault("news_flags", []).append("CFO departure (2026-04-12)")
    cp.profile_json = profile
    await s.commit()

    await bus.publish({
        "type": "counterparty_updated",
        "counterparty": {
            "id": cp.id, "name": cp.name, "health_tag": cp.health_tag,
            "profile_json": cp.profile_json,
        },
    })
    return {"ok": True, "counterparty_id": cp.id}


@router.post("/trigger/queue-vendor-payment")
async def trigger_vendor_payment(s: AsyncSession = Depends(get_session)) -> dict:
    """Beat 2: queue the mystery vendor payment. Should fire R3 + R4."""
    tx = TransactionRow(
        id=f"tx_{uuid4().hex[:8]}",
        direction="out",
        counterparty_id="cp_strp_comm_eu",
        account_id="acc_eu_op",
        amount=47000,
        currency="EUR",
        status="queued_for_approval",
        description="Invoice #STRP-2026-04-30",
        occurred_at=datetime.now(timezone.utc),
    )
    s.add(tx)
    await s.commit()

    await bus.publish({
        "type": "transaction_posted",
        "transaction": {
            "id": tx.id, "direction": tx.direction, "counterparty_id": tx.counterparty_id,
            "account_id": tx.account_id, "amount": tx.amount, "currency": tx.currency,
            "status": tx.status, "description": tx.description,
            "occurred_at": tx.occurred_at.isoformat(),
        },
    })
    return {"ok": True, "transaction_id": tx.id}


@router.post("/trigger/customer-turn")
async def trigger_customer_turn(s: AsyncSession = Depends(get_session)) -> dict:
    """Beat 3: flip Globex to fragile while they owe us money."""
    cp = (await s.execute(select(CounterpartyRow).where(CounterpartyRow.id == "cp_globex"))).scalar_one_or_none()
    if not cp:
        raise HTTPException(404, "Globex not seeded")
    cp.health_tag = "fragile"
    profile = dict(cp.profile_json or {})
    profile.setdefault("news_flags", []).append("Funding round failed (2026-04-29)")
    cp.profile_json = profile
    await s.commit()
    await bus.publish({
        "type": "counterparty_updated",
        "counterparty": {
            "id": cp.id, "name": cp.name, "health_tag": cp.health_tag,
            "profile_json": cp.profile_json,
        },
    })
    return {"ok": True, "counterparty_id": cp.id}
