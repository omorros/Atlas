#!/usr/bin/env python3
"""Run sample RiskEventCandidates through triage + analyst (risk engine smoke test).

Usage (from repo root):
  cd api && python ../scripts/eval_risk_harness.py

Requires ANTHROPIC_API_KEY (+ OPENAI for embeddings in similar-flags path).
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent / "api"
sys.path.insert(0, str(API_ROOT))

from app.db import CounterpartyRow, SessionLocal  # noqa: E402
from app.rules.candidate import RiskEventCandidate  # noqa: E402
from app.seed import seed_if_empty  # noqa: E402
from app.workers import analyst, embeddings, triage  # noqa: E402


async def _main() -> None:
    await seed_if_empty()
    cand = RiskEventCandidate(
        counterparty_id="cp_strp_comm_eu",
        trigger_rule="R3",
        trigger_payload={"demo": "eval harness"},
        raw_score=0.6,
    )
    tri_in = {
        "trigger_rule": cand.trigger_rule,
        "trigger_payload": cand.trigger_payload,
        "raw_score": cand.raw_score,
    }
    async with SessionLocal() as session:
        row = await session.get(CounterpartyRow, cand.counterparty_id)
        cp = {
            "id": cand.counterparty_id,
            "name": row.name if row else cand.counterparty_id,
            "type": row.type if row else "?",
            "profile_json": dict(row.profile_json) if row and row.profile_json else {},
            "health_tag": row.health_tag if row else "stable",
        }
        prof = cp.get("profile_json") or {}
        qtext = f"{cp.get('name', '')} {prof.get('address', '')}".strip()
        similar = await embeddings.similar_flags_for_counterparty(session, cand.counterparty_id, qtext)
        tr = await triage.triage(tri_in, cand.counterparty_id, session)
        await session.commit()

    ctx = {"counterparty": cp, "similar_flags": similar, "candidate": cand}
    event = {
        "id": "re_eval_stub",
        "counterparty_id": cand.counterparty_id,
        "trigger_rule": cand.trigger_rule,
        "trigger_payload": cand.trigger_payload,
        "raw_score": cand.raw_score,
    }
    brief = await analyst.write_brief(event, ctx)
    brief_meta = {k: v for k, v in brief.items() if k not in ("body_md", "specter_snapshot", "similar_flags")}
    print(
        json.dumps(
            {
                "triage": tr,
                "similar_flags": similar[:3],
                "brief": brief_meta,
                "body_preview": (brief.get("body_md") or "")[:500],
            },
            indent=2,
            default=str,
        )
    )


if __name__ == "__main__":
    asyncio.run(_main())
