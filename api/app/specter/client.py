"""Specter client - boot-time enrichment + on-demand lookups. Owner: D.

Falls back to fixtures (`shared/fixtures.json::specter_profiles`) if no key or API down.
Demo never breaks.
"""
from __future__ import annotations

import json

import httpx

from ..config import settings


def _load_canned() -> dict:
    with open(settings.FIXTURES_PATH) as f:
        return json.load(f).get("specter_profiles", {})


_CANNED = _load_canned()


async def fetch_profile(specter_id: str) -> dict | None:
    """Returns a Specter-shaped profile dict or None."""
    if not settings.SPECTER_API_KEY:
        return _CANNED.get(specter_id)

    # TODO(D): call Specter REST API (settings.SPECTER_BASE_URL) with SPECTER_API_KEY.
    # Map response into the SpecterProfile shape (see shared/schemas.py).
    # On any error: log and return _CANNED.get(specter_id).
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get(
                f"{settings.SPECTER_BASE_URL}/companies/{specter_id}",
                headers={"Authorization": f"Bearer {settings.SPECTER_API_KEY}"},
            )
            r.raise_for_status()
            # TODO(D): translate response shape -> our SpecterProfile shape
            return _CANNED.get(specter_id)  # placeholder: still use canned until mapped
    except Exception as e:
        print(f"[specter] fallback for {specter_id}: {e}")
        return _CANNED.get(specter_id)


async def search_company(name: str) -> dict | None:
    """For R3 - look up an unknown counterparty by name."""
    if not settings.SPECTER_API_KEY:
        return None
    # TODO(D): implement search endpoint
    return None
