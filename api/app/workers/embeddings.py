"""Embeddings — OpenAI text-embedding-3-large + cosine similarity for similar-flags."""
from __future__ import annotations

import json
import math
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import CounterpartyRow
from ..llm_metrics import record_tokens

MODEL = "text-embedding-3-large"

_shell_cache: dict[str, list[float]] = {}


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


async def embed(text: str) -> list[float] | None:
    if not settings.OPENAI_API_KEY:
        return None
    text = (text or "").strip()[:8000]
    if not text:
        return None
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    resp = await client.embeddings.create(model=MODEL, input=text)
    vec = list(resp.data[0].embedding)
    usage = getattr(resp, "usage", None)
    if usage is not None:
        t = getattr(usage, "total_tokens", None) or getattr(usage, "prompt_tokens", None)
        if t:
            record_tokens(MODEL, int(t), 0)
    return vec


def _shell_entries() -> list[dict[str, str]]:
    try:
        with open(settings.FIXTURES_PATH) as f:
            data = json.load(f)
        return data.get("shell_flag_history") or []
    except Exception:
        return []


async def _ensure_shell_embeddings() -> list[dict[str, Any]]:
    global _shell_cache
    out: list[dict[str, Any]] = []
    for row in _shell_entries():
        sid = row.get("id") or ""
        text = f"{row.get('name', '')} {row.get('address', '')}".strip()
        if not text:
            continue
        if sid not in _shell_cache:
            ev = await embed(text)
            if ev:
                _shell_cache[sid] = ev
        if sid in _shell_cache:
            out.append(
                {
                    "counterparty_id": sid,
                    "name": row.get("name", sid),
                    "embedding": _shell_cache[sid],
                    "flagged_at": row.get("flagged_at", ""),
                }
            )
    return out


async def _ensure_counterparty_embeddings(session: AsyncSession) -> None:
    rows = (await session.execute(select(CounterpartyRow))).scalars().all()
    for row in rows:
        if row.embedding is not None:
            continue
        if (row.health_tag or "") not in ("fragile", "watch"):
            continue
        prof = dict(row.profile_json) if row.profile_json else {}
        text = f"{row.name} {prof.get('address', '')}".strip()
        if not text:
            continue
        vec = await embed(text)
        if vec:
            row.embedding = vec
    await session.flush()


async def similar_flags_for_counterparty(
    session: AsyncSession, counterparty_id: str, query_text: str
) -> list[dict[str, Any]]:
    """Top similar historically risky / shell-flagged entities by cosine similarity."""
    await _ensure_counterparty_embeddings(session)
    q = await embed(query_text)
    if not q:
        return []

    raw_rows = (
        await session.execute(
            select(CounterpartyRow).where(CounterpartyRow.health_tag.in_(["fragile", "watch"]))
        )
    ).scalars().all()
    corpus_rows = [r for r in raw_rows if r.embedding is not None]

    corpus: list[dict[str, Any]] = []
    for row in corpus_rows:
        if row.id == counterparty_id:
            continue
        corpus.append(
            {
                "counterparty_id": row.id,
                "name": row.name,
                "embedding": row.embedding,
                "flagged_at": "",
            }
        )

    for s in await _ensure_shell_embeddings():
        corpus.append(s)

    scored = []
    for c in corpus:
        emb = c.get("embedding")
        if not emb:
            continue
        sim = cosine(q, emb)
        scored.append(
            {
                "counterparty_id": c["counterparty_id"],
                "name": c.get("name", c["counterparty_id"]),
                "cosine_sim": round(sim, 4),
                "flagged_at": c.get("flagged_at", ""),
            }
        )
    scored.sort(key=lambda x: x["cosine_sim"], reverse=True)
    return scored[:5]


async def find_similar(query_text: str, corpus: list[dict], top_k: int = 3) -> list[dict]:
    """Lower-level helper for eval harness."""
    q = await embed(query_text)
    if q is None:
        return []
    scored = [
        {
            "counterparty_id": c["id"],
            "name": c["name"],
            "cosine_sim": cosine(q, c["embedding"]),
            "flagged_at": c.get("flagged_at", ""),
        }
        for c in corpus
        if c.get("embedding")
    ]
    scored.sort(key=lambda x: x["cosine_sim"], reverse=True)
    return scored[:top_k]
