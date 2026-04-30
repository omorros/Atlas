"""Background transaction simulator. Owner: A.

Generates realistic background activity so the demo feels alive even between triggers.
"""
from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select

from .db import AccountRow, CounterpartyRow, SessionLocal, TransactionRow
from .events import bus

VENDOR_RECURRING = ["cp_aws", "cp_stripe", "cp_googleads", "cp_anthropic", "cp_wework"]
CUSTOMER_RECURRING = ["cp_acme_retail", "cp_initech"]


async def tick() -> None:
    """One simulator tick: maybe emit one outgoing or incoming txn."""
    if random.random() > 0.3:
        return
    async with SessionLocal() as s:
        accounts = (await s.execute(select(AccountRow))).scalars().all()
        if not accounts:
            return
        if random.random() < 0.6:
            cp_id = random.choice(VENDOR_RECURRING)
            direction = "out"
            amt = random.randint(500, 8000)
        else:
            cp_id = random.choice(CUSTOMER_RECURRING)
            direction = "in"
            amt = random.randint(2000, 25000)
        acc = random.choice(accounts)
        tx = TransactionRow(
            id=f"tx_sim_{uuid4().hex[:8]}",
            direction=direction,
            counterparty_id=cp_id,
            account_id=acc.id,
            amount=amt,
            currency=acc.currency,
            status="posted",
            description="(simulated)",
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


async def run(interval_seconds: float = 4.0) -> None:
    while True:
        try:
            await tick()
        except Exception as e:
            print(f"[simulator] {e}")
        await asyncio.sleep(interval_seconds)
