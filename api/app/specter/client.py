"""Specter client - boot-time enrichment + on-demand lookups. Owner: D.

Falls back to fixtures (`shared/fixtures.json::specter_profiles`) if no key or API down.
Demo never breaks.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
from sqlalchemy import select

from ..config import settings
from ..db import CounterpartyRow, SessionLocal


def _load_canned() -> dict:
    with open(settings.FIXTURES_PATH) as f:
        return json.load(f).get("specter_profiles", {})


_CANNED = _load_canned()


def _api_headers() -> dict[str, str]:
    return {
        "X-API-Key": settings.SPECTER_API_KEY or "",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _first(value: Any) -> Any:
    if isinstance(value, list):
        return value[0] if value else None
    return value


def _value(obj: Any, *keys: str) -> Any:
    cur = obj
    for key in keys:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def _address(company: dict[str, Any]) -> str:
    hq = company.get("hq") if isinstance(company.get("hq"), dict) else {}
    parts = [
        hq.get("address"),
        hq.get("city"),
        hq.get("region"),
        hq.get("country"),
    ]
    return ", ".join(str(p) for p in parts if p) or str(company.get("address") or "")


def _website(company: dict[str, Any]) -> str | None:
    website = company.get("website")
    if isinstance(website, dict):
        return website.get("url") or website.get("website_url") or website.get("domain")
    if isinstance(website, str):
        return website
    return company.get("website_url") or company.get("domain")


def _funding_amount_musd(company: dict[str, Any]) -> float | None:
    funding = company.get("funding") if isinstance(company.get("funding"), dict) else {}
    amount = funding.get("last_funding_usd") or company.get("last_funding_usd")
    if amount is None:
        return None
    try:
        return round(float(amount) / 1_000_000, 2)
    except (TypeError, ValueError):
        return None


def _normalize_profile(company: dict[str, Any], fallback: dict | None = None) -> dict | None:
    """Map Specter's broad company object into our small SpecterProfile contract."""
    if not company:
        return fallback

    funding = company.get("funding") if isinstance(company.get("funding"), dict) else {}
    highlights = company.get("new_highlights") or company.get("highlights") or []
    if not isinstance(highlights, list):
        highlights = [str(highlights)]

    incorporated = (
        company.get("incorporated")
        or company.get("founded_on")
        or company.get("founding_date")
        or (str(int(company["founded_year"])) if company.get("founded_year") else None)
        or (fallback or {}).get("incorporated")
        or "unknown"
    )

    profile = {
        "company": company.get("name") or company.get("company") or (fallback or {}).get("company") or "Unknown",
        "headcount": int(company.get("employee_count") or company.get("headcount") or (fallback or {}).get("headcount") or 0),
        "headcount_delta_90d_pct": float(
            company.get("headcount_delta_90d_pct")
            or _value(company, "growth", "employee_count_90d_pct")
            or (fallback or {}).get("headcount_delta_90d_pct")
            or 0
        ),
        "last_funding_round_date": funding.get("last_funding_date")
        or company.get("last_funding_date")
        or (fallback or {}).get("last_funding_round_date"),
        "last_funding_round_amount_musd": _funding_amount_musd(company)
        if _funding_amount_musd(company) is not None
        else (fallback or {}).get("last_funding_round_amount_musd"),
        "investors": company.get("investors") if isinstance(company.get("investors"), list) else (fallback or {}).get("investors", []),
        "news_flags": [str(x) for x in highlights] or (fallback or {}).get("news_flags", []),
        "incorporated": str(incorporated),
        "website": _website(company) or (fallback or {}).get("website"),
        "address": _address(company) or (fallback or {}).get("address", ""),
    }
    return profile


async def fetch_profile(specter_id: str) -> dict | None:
    """Returns a Specter-shaped profile dict or None."""
    fallback = _CANNED.get(specter_id)
    if not settings.SPECTER_API_KEY:
        return fallback

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{settings.SPECTER_BASE_URL}/companies/{specter_id}",
                headers=_api_headers(),
            )
            r.raise_for_status()
            return _normalize_profile(r.json(), fallback)
    except Exception as e:
        print(f"[specter] fallback for {specter_id}: {e}")
        return fallback


async def search_company(name: str) -> dict | None:
    """For R3 - look up an unknown counterparty by name."""
    if not settings.SPECTER_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{settings.SPECTER_BASE_URL}/companies/search",
                params={"query": name},
                headers=_api_headers(),
            )
            r.raise_for_status()
            match = _first(r.json())
            if not isinstance(match, dict):
                return None
            company_id = match.get("id") or match.get("company_id") or match.get("companyId")
            if company_id:
                return await fetch_profile(str(company_id))
            return _normalize_profile(match)
    except Exception as e:
        print(f"[specter] search failed for {name}: {e}")
        return None


async def enrich_counterparties() -> None:
    """Refresh Specter snapshots for seeded counterparties at boot; never blocks demo startup."""
    async with SessionLocal() as session:
        rows = (await session.execute(select(CounterpartyRow).where(CounterpartyRow.specter_id.is_not(None)))).scalars().all()
        if not rows:
            return

        profiles = await asyncio.gather(
            *(fetch_profile(str(row.specter_id)) for row in rows),
            return_exceptions=True,
        )
        changed = False
        for row, profile in zip(rows, profiles, strict=False):
            if isinstance(profile, Exception) or not profile:
                continue
            row.profile_json = profile
            changed = True
        if changed:
            await session.commit()
