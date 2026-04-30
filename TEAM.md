# Team Plan — 4 people, 48h

> Pin this. Read once at kickoff and check at every sync.

## At-a-glance

| Owner | Role | Lives in | Ships |
|---|---|---|---|
| **Oriol** | UI Lead | `web/**` | Landing + war-room dashboard + demo polish |
| **P2** | Backend Spine | `api/app/{main,db,events,simulator,routers}.py` | API, WebSocket fan-out, simulator, metrics |
| **P3** | Risk Brain | `api/app/{rules,workers}/**` | Rules, Haiku triage, Sonnet analyst, OpenAI embeddings |
| **P4** | Integrations | `api/app/specter/**` + `agent-svc/**` | Specter client, Cursor SDK sidecar, deep investigation |

## Branch convention
```
feat/oriol-<slice>
feat/p2-<slice>
feat/p3-<slice>
feat/p4-<slice>
```
Daily merge to `main`. No PR ceremony — small commits, frequent pulls.

## Day 1 — first 24h

### Oriol (UI)
- [x] Landing page (`web/app/page.tsx`) — done
- [x] War-room shell at `/app` (`web/app/app/page.tsx`) — done
- [ ] Render `body_md` as proper markdown in `BriefModal` (use `react-markdown`)
- [ ] Tab filtering in `RiskInbox` (Critical / Auto-flagged / Resolved by event status)
- [ ] Add a `react-markdown` dep + finalize modal layout
- [ ] Wire `InvestigationPanel` to `useWS({ investigation_event })`
- [ ] Polish demo dock animations (shake on click, pulse colour matching event severity)
- [ ] Make landing copy + stat counters accurate

### P2 (Backend Spine)
- [ ] Boot the rule engine + simulator in `app/main.py` lifespan
- [ ] Add `POST /internal/investigation-events` to forward sidecar events to WS bus
- [ ] Wire `llm_spend_usd` tracking in metrics (P3 will increment on each call)
- [ ] Add `POST /demo/reset` to wipe + reseed for repeat demo runs
- [ ] WS reconnect resilience (already mostly there client-side; ensure server cleans up dead queues)

### P3 (Risk Brain)
- [ ] Implement R1 (`r1_specter_delta.py`) — headcount drop / failed funding / news flags
- [ ] Implement R3 (`r3_new_counterparty.py`) — first-ever transaction with a counterparty
- [ ] Implement R4 (`r4_anomalous_payment.py`) — anomalous payment amount or to a young counterparty
- [ ] Wire Haiku triage call in `workers/triage.py` (with token + latency tracking)
- [ ] Wire Sonnet analyst call in `workers/analyst.py` — design the system prompt to emit markdown body + trailing JSON `{confidence, recommended_action}`
- [ ] Persist Brief on success; emit `brief_ready` over the EventBus

### P4 (Integrations)
- [ ] Get a Specter key from Francisco on Discord
- [ ] Implement real Specter REST mapping in `api/app/specter/client.py`
- [ ] Boot-time enrichment for every counterparty (parallel `asyncio.gather`)
- [ ] Get a Cursor SDK key (see README §API keys)
- [ ] Run the cookbook quickstart locally to make sure your key works
- [ ] Sidecar streams fake events end-to-end (already scaffolded)

## Day 2 — last 24h

### Oriol (UI)
- [ ] Globe upgrade: replace per-marker DOM with a circle layer + GeoJSON source
- [ ] Pulse animation on `risk_event_created`
- [ ] Transient line for `transaction_posted` (fade out 3s)
- [ ] Investigation side panel rendering live `tool_call` / `thinking` events
- [ ] Stretch: voice trigger ("trigger neobank x") via Whisper

### P2 (Backend Spine)
- [ ] LLM spend meter visible in `/state` metrics
- [ ] Calibrated burn-rate metric in `compute_metrics`
- [ ] Rate-limit handling on outbound LLM calls (retry with jitter)
- [ ] Reset endpoint for clean demo runs

### P3 (Risk Brain)
- [ ] OpenAI embeddings worker (real call, in-memory cosine over counterparty corpus)
- [ ] Inject `similar_flags` into analyst prompt for R3/R4 events
- [ ] Eval harness (`scripts/eval.py`) — golden set of 20 fixture risk events, expected severity, calibration plot
- [ ] Calibrate Sonnet confidences

### P4 (Integrations)
- [ ] Real `@cursor/sdk` calls in `agent-svc/src/investigate.ts` — Cloud Agent against an empty repo with a small toolkit
- [ ] Forward streamed events to FastAPI's `/internal/investigation-events`
- [ ] Artifact download endpoint
- [ ] Specter MCP for the Cloud Agent if Francisco gives access

## Last 6 hours — ALL HANDS

- [ ] Lock the 90s demo (script, voiceover, screen recording backup)
- [ ] Eval pass on 20 fixture RiskEvents
- [ ] Polish: empty states, loading states, error toasts, sandbox banner
- [ ] Submit

## How not to step on each other

| You're touching | Coordinate with |
|---|---|
| `shared/types.ts` or `shared/schemas.py` | EVERYONE — message in the group chat first |
| `app/main.py` lifespan | P2 owns; P3 needs them to call rule-engine.start() |
| EventBus event shape | P2 owns; P3 + P4 publish; Oriol consumes |
| Sonnet prompt | P3 owns |
| Cursor cloud agent prompt | P4 owns |

## Tickets

`grep -rn "TODO(A)" .` for P2's tickets, `TODO(B)` for P3, `TODO(D)` for P4. Oriol's tickets are in `web/README.md`.

## API keys checklist

Before committing any code, every owner has:
- [ ] **Oriol**: `NEXT_PUBLIC_MAPBOX_TOKEN` in `web/.env`
- [ ] **P3**: `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in `api/.env`
- [ ] **P4**: `SPECTER_API_KEY` in `api/.env`, `CURSOR_API_KEY` in `agent-svc/.env`

See README §API keys for where to get each.
