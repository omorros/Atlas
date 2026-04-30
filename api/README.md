# api/ — FastAPI backend

**Subsystem:** core API (routing, DB, seed, demo) and **risk engine** (rules R1–R4, LLM workers, pipeline).

## Quickstart
```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

DB seeds itself from `shared/fixtures.json` on first boot. SQLite file lives at `api/data/radar.db` (gitignored).

## What's wired vs TODO

| Module | Status | Subsystem |
|---|---|---|
| `app/main.py` — FastAPI app, lifespan, routers | ✅ wired | Core API |
| `app/db.py` — SQLAlchemy models | ✅ wired | Core API |
| `app/seed.py` — load fixtures into DB | ✅ wired | Core API |
| `app/routers/state.py` — `GET /state` | ✅ wired with metrics calc | Core API |
| `app/routers/demo.py` — 3 demo triggers | ✅ wired (publish to bus, mutate DB) | Core API |
| `app/routers/risk_events.py` — escalate/dismiss/resolve/investigate | ✅ wired | Core API |
| `app/routers/ws.py` — `WS /events/stream` | ✅ wired | Core API |
| `app/events.py` — in-process EventBus | ✅ wired | Core API |
| `app/simulator.py` — background txns | ✅ wired (not started in lifespan yet) | Core API |
| `app/rules/r1_specter_delta.py` | ✅ R1 | Risk engine |
| `app/rules/r2_standing_exposure.py` | ✅ R2 | Risk engine |
| `app/rules/r3_new_counterparty.py` | ✅ R3 | Risk engine |
| `app/rules/r4_anomalous_payment.py` | ✅ R4 | Risk engine |
| `app/rules/base.py` + `risk_pipeline.py` | ✅ 5s tick → triage → analyst → persist + WS | Risk engine |
| `app/workers/triage.py` — Haiku | ✅ (fallback keep=True if no key) | Risk engine |
| `app/workers/analyst.py` — Sonnet | ✅ (fallback brief if no key) | Risk engine |
| `app/workers/embeddings.py` — OpenAI + cosine | ✅ similar-flags corpus (watch/fragile + shells) | Risk engine |
| `../scripts/eval_risk_harness.py` | ✅ sample R3 path | Risk engine |
| `app/specter/client.py` — REST + canned fallback | ⏳ stub (canned works) | Integrations |

## TODO markers
Search for `TODO(A)` / `TODO(B)` / `TODO(D)` in the source (team shorthand in code comments).

## Run the demo from CLI
```bash
curl -X POST http://localhost:8000/demo/trigger/bank-downgrade
curl -X POST http://localhost:8000/demo/trigger/queue-vendor-payment
```

## Reset
```bash
rm api/data/radar.db && python -m app.seed
```
