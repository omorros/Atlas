# api/ — FastAPI backend

**Owner: A (spine + sim) and B (rules + workers).**

## Quickstart
```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

DB seeds itself from `shared/fixtures.json` on first boot. SQLite file lives at `api/data/radar.db` (gitignored).

## What's wired vs TODO

| Module | Status | Owner |
|---|---|---|
| `app/main.py` — FastAPI app, lifespan, routers | ✅ wired | A |
| `app/db.py` — SQLAlchemy models | ✅ wired | A |
| `app/seed.py` — load fixtures into DB | ✅ wired | A |
| `app/routers/state.py` — `GET /state` | ✅ wired with metrics calc | A |
| `app/routers/demo.py` — 3 demo triggers | ✅ wired (publish to bus, mutate DB) | A |
| `app/routers/risk_events.py` — escalate/dismiss/resolve/investigate | ✅ wired | A |
| `app/routers/ws.py` — `WS /events/stream` | ✅ wired | A |
| `app/events.py` — in-process EventBus | ✅ wired | A |
| `app/simulator.py` — background txns | ✅ wired (not started in lifespan yet) | A |
| `app/rules/r1_specter_delta.py` | ⏳ stub | B |
| `app/rules/r3_new_counterparty.py` | ⏳ stub | B |
| `app/rules/r4_anomalous_payment.py` | ⏳ stub | B |
| `app/rules/base.py` — engine loop | ✅ framework / ⏳ wire to workers | B |
| `app/workers/triage.py` — Haiku call | ⏳ stub (fallback to keep=True) | B |
| `app/workers/analyst.py` — Sonnet call | ⏳ stub (fallback brief) | B |
| `app/workers/embeddings.py` — OpenAI + cosine | ⏳ stub | B |
| `app/specter/client.py` — REST + canned fallback | ⏳ stub (canned works) | D |

## TODO markers
Search for `TODO(A)` / `TODO(B)` / `TODO(D)` in the source.

## Run the demo from CLI
```bash
curl -X POST http://localhost:8000/demo/trigger/bank-downgrade
curl -X POST http://localhost:8000/demo/trigger/queue-vendor-payment
```

## Reset
```bash
rm api/data/radar.db && python -m app.seed
```
