"""Embeddings worker - OpenAI text-embedding-3-large. Owner: B.

In-memory cosine similarity over our small (~50) counterparty set. No pgvector needed.
"""
from __future__ import annotations

import math

from ..config import settings

MODEL = "text-embedding-3-large"


async def embed(text: str) -> list[float] | None:
    """Returns the embedding vector or None if no key."""
    if not settings.OPENAI_API_KEY:
        return None
    # TODO(B): call openai.AsyncOpenAI().embeddings.create(model=MODEL, input=text)
    return None


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


async def find_similar(query_text: str, corpus: list[dict], top_k: int = 3) -> list[dict]:
    """corpus: [{'id', 'name', 'embedding', 'flagged_at'}]. Returns top_k by cosine."""
    q = await embed(query_text)
    if q is None:
        return []
    scored = [
        {"counterparty_id": c["id"], "name": c["name"], "cosine_sim": cosine(q, c["embedding"]),
         "flagged_at": c.get("flagged_at", "")}
        for c in corpus if c.get("embedding")
    ]
    scored.sort(key=lambda x: x["cosine_sim"], reverse=True)
    return scored[:top_k]
