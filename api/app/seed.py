"""Seed the DB from shared/fixtures.json. Idempotent: only seeds if empty."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime

from sqlalchemy import delete, select

from .config import settings
from .db import (
    AccountRow,
    BriefRow,
    CounterpartyRow,
    InvestigationRow,
    RiskEventRow,
    SessionLocal,
    TransactionRow,
    init_db,
)


def load_fixtures() -> dict:
    with open(settings.FIXTURES_PATH) as f:
        return json.load(f)


async def _apply_fixtures(s, fx: dict) -> None:
    for cp in fx["counterparties"]:
        profile = fx["specter_profiles"].get(cp.get("specter_id"))
        s.add(
            CounterpartyRow(
                id=cp["id"],
                name=cp["name"],
                type=cp["type"],
                provider=cp["provider"],
                region=cp["region"],
                lat=cp["lat"],
                lng=cp["lng"],
                specter_id=cp.get("specter_id"),
                profile_json=profile,
                health_tag=cp.get("health_tag", "stable"),
                max_exposure_pct=cp.get("max_exposure_pct", 1.0),
            )
        )

    for acc in fx["accounts"]:
        s.add(AccountRow(**acc))

    for tx in fx["transactions"]:
        s.add(
            TransactionRow(
                id=tx["id"],
                direction=tx["direction"],
                counterparty_id=tx["counterparty_id"],
                account_id=tx["account_id"],
                amount=tx["amount"],
                currency=tx["currency"],
                status=tx["status"],
                description=tx["description"],
                occurred_at=datetime.fromisoformat(tx["occurred_at"].replace("Z", "+00:00")),
            )
        )


async def _truncate_all(s) -> None:
    await s.execute(delete(InvestigationRow))
    await s.execute(delete(BriefRow))
    await s.execute(delete(RiskEventRow))
    await s.execute(delete(TransactionRow))
    await s.execute(delete(AccountRow))
    await s.execute(delete(CounterpartyRow))


async def truncate_and_seed() -> None:
    await init_db()
    fx = load_fixtures()
    async with SessionLocal() as s:
        await _truncate_all(s)
        await s.commit()
        await _apply_fixtures(s, fx)
        await s.commit()


async def seed_if_empty() -> None:
    await init_db()
    fx = load_fixtures()

    async with SessionLocal() as s:
        existing = (await s.execute(select(CounterpartyRow))).first()
        if existing:
            return

        await _apply_fixtures(s, fx)
        await s.commit()


async def main() -> None:
    await seed_if_empty()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
