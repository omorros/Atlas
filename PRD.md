# Counterparty Risk Radar
**Cursor × Briefcase London 2026 — Track 02: Financial Intelligence**

## 0. TL;DR

A real-time treasury intelligence control room. The agent continuously reads transactions and standing exposures across **banks, vendors, and customers**; enriches every counterparty via **Specter**; scores risk through a **hybrid rule + multi-model LLM pipeline**; and surfaces written briefs with confidence scores into a **Mapbox war-room UI**. Humans decide; the agent never moves money.

**One-liner for the judges:** *"Read, score, escalate. The agent never moves a penny."*

---

## 1. Why this wins (rubric mapping)

| Rubric item | Pts | How we earn it |
|---|---|---|
| Track Fit (Track 02) | 2 | Every action is *read / interpret / escalate*. Pre-payment surface is informational only — agent never gates or moves money. |
| Concrete Workflow Value | 2 | Replaces three real workflows accountants/treasurers do manually today: counterparty due diligence, mystery-charge resolution, exposure monitoring. Briefcase CTO is a judge — this is his world. |
| Human-in-the-Loop | 1 | LLM-emitted confidence on every brief; explicit thresholds (`≥0.85` auto-flag, `0.5–0.85` escalate to human, `<0.5` suppress). Visible in UI. |
| Technical Execution | 1 | Hybrid rule engine + 4-tier model routing + WebSocket streaming + Mapbox globe + Cursor SDK sidecar. |
| Demo Clarity | 1 | Single 90s scripted narrative (bank run → mystery vendor). Judge gets the whole product in one minute thirty. |
| **Best use of Cursor** | +1 | Cursor Cloud Agent powers the "Deep Investigation" feature; agent's tool calls stream live into the UI. We also build the whole project in Cursor end-to-end. |
| **Best use of Specter** | +1 | Specter is the spine of risk scoring — every brief cites Specter data; mystery-vendor demo beat is pure Specter shell-detection. |
| **Best use of LLM models** | +1 | 4 distinct model picks, each chosen for what it does best: Haiku (triage), OpenAI embeddings (similarity), Sonnet (analyst), Cursor composer-2 (long-horizon investigation). |

**Target: 7 + 3 = 10/10.**

---

## 2. Hero demo script (90 seconds)

**0:00–0:10 — Set the scene.** Calm globe. Cursor over a node shows *"MainBank UK · $2.1M · health: stable"*. Voiceover: *"This is a treasury control room. Every node is a counterparty — banks, vendors, customers. The agent watches all of them."*

**0:10–0:45 — Beat 1: The Bank Run.**
- Press *Trigger: Neobank X downgrade* (demo dock).
- Three nodes on the globe pulse red.
- Risk Inbox card flies in: *"Neobank X health degraded — confidence 0.91."*
- Open the brief. Read aloud: *"Headcount −32% in 90 days, last raise 28 months ago, exposure $2.1M (38% of regional cash). Recommend: escalate to CFO."*
- Show the Specter snapshot pinned to the brief.
- Click **Escalate**. Card moves to Critical tab.

**0:45–1:25 — Beat 2: The Mystery Vendor.**
- Press *Trigger: Queue $47K to STRP-COMM-EU*.
- Inbox card: *"Unknown vendor flagged — confidence 0.78."*
- Brief: *"Counterparty incorporated 4mo ago, 1 employee, no website, address shared with 3 prior shell flags (cosine sim 0.94). Recommend: hold and verify."*
- Click **Investigate further**. Side panel opens. **Cursor Cloud Agent** boots, streams its thinking and tool calls live: *"searching Companies House…"*, *"cross-referencing director records…"*, *"writing forensic memo…"*. Show the memo artifact appearing.

**1:25–1:30 — Close.** Pull back to globe. *"Read, score, escalate. The agent never moved a penny."*

---

## 3. Users & use cases

**Primary user:** Treasury manager / finance lead at a mid-market company (50–500 staff) with multiple bank accounts and dozens to hundreds of active vendors and customers.

**Use cases covered:**
1. **Standing exposure monitoring** — Where is my cash sitting and is it safe right now?
2. **Pre-payment intelligence** — Should I pay this vendor I don't recognise?
3. **Counterparty deep dive** — When something looks weird, give me a forensic answer in 2 minutes, not 2 days.
4. **Inbound counterparty health** — Is the customer who owes me $180K still solvent?

---

## 4. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend — Next.js 14 + Mapbox GL JS (globe projection)     │
│  • Globe with counterparty nodes                             │
│  • Risk Inbox sidebar (Critical / Auto-flagged / Resolved)   │
│  • Brief modal (markdown + Specter snapshot + actions)       │
│  • Investigation side panel (live Cursor agent stream)       │
│  • Demo dock (3 trigger buttons)                             │
└────────────────────────┬─────────────────────────────────────┘
                         │ WebSocket (state + events)
┌────────────────────────▼─────────────────────────────────────┐
│  Backend — FastAPI (Python 3.11)                             │
│  ├─ Postgres (counterparties, accounts, txns, risk events)   │
│  ├─ Rule Engine — runs every 5s, emits RiskEvent candidates  │
│  ├─ Triage Worker — Anthropic Haiku 4.5                      │
│  ├─ Analyst Worker — Anthropic Sonnet 4.6                    │
│  ├─ Embeddings Worker — OpenAI text-embedding-3-large        │
│  ├─ Specter client — boot-time cache + on-demand enrichment  │
│  └─ Transaction simulator — background activity              │
└─────────┬───────────────────────────────────┬────────────────┘
          │ HTTP /investigate                  │
┌─────────▼─────────────────────────┐         │
│  Agent Sidecar — Node 22 + Express│         │
│  • Owns Cursor SDK (@cursor/sdk)  │         │
│  • Spawns Cursor Cloud Agents     │         │
│  • Streams events back over WS    │         │
└───────────────────────────────────┘         │
                                              │
                         ┌────────────────────▼──────────┐
                         │  External APIs                │
                         │  • Specter (counterparty data)│
                         │  • Anthropic (Haiku, Sonnet)  │
                         │  • OpenAI (embeddings)        │
                         │  • Cursor (cloud agents)      │
                         └───────────────────────────────┘
```

---

## 5. Data model

### Counterparty
```
id              str
name            str
type            enum   bank | vendor | customer
provider        str    (logical key, e.g. "neobank_x")
region          enum   UK | EU | US | APAC
lat, lng        float
specter_id      str?
profile_json    json   (cached Specter blob)
embedding       vector (pgvector, 3072 dims)
health_tag      enum   stable | watch | fragile
max_exposure_pct float (policy cap)
created_at      timestamp
```

### Account (your money — only meaningful when type=bank)
```
id              str
counterparty_id str  (FK → bank counterparty)
name            str
currency        iso3
balance         decimal
region          enum
```

### Transaction
```
id              str
direction       enum   in | out
counterparty_id str
account_id      str
amount          decimal
currency        iso3
status          enum   scheduled | posted | queued_for_approval
description     str
occurred_at     timestamp
```

### RiskEvent
```
id               str
counterparty_id  str
trigger_rule     str   (R1, R2, R3, R4, R5)
trigger_payload  json  (what changed, raw)
raw_score        float (rule-derived 0–1)
llm_confidence   float (Sonnet-derived 0–1)
severity         enum  info | warn | critical
status           enum  open | escalated | dismissed | resolved
created_at       timestamp
```

### Brief
```
id               str
risk_event_id    str
headline         str
body_md          str   (markdown analyst brief)
recommended_action str
specter_snapshot json
similar_flags    json  (embedding nearest neighbours)
model_used       str
tokens_in        int
tokens_out       int
latency_ms       int
created_at       timestamp
```

### Investigation (Cursor Cloud Agent run — P1)
```
id               str
risk_event_id    str
cursor_agent_id  str
status           enum  running | finished | error | cancelled
events           json  (streamed tool calls / thinking)
artifacts        json  ([{path, mime, url}])
duration_ms      int
created_at, finished_at  timestamp
```

---

## 6. Risk scoring & HITL pipeline

**Every 5 seconds:**

1. **Rule Engine** scans state changes and emits RiskEvent *candidates*. Cheap, deterministic. (See §7 for rule library.)

2. **Triage (Haiku 4.5)** — One LLM call per candidate. Inputs: rule, payload, counterparty profile excerpt. Output: `{keep: bool, reason: str}`. Drops noise candidates (e.g. R3 fired on a known counterparty already enriched).

3. **Embeddings worker** — For survivors involving new or unknown counterparties, embed `name + address + description` via OpenAI `text-embedding-3-large`, search pgvector for nearest neighbours among historically-flagged counterparties. Output: `[{counterparty_id, cosine_sim}]` injected into analyst prompt.

4. **Analyst (Sonnet 4.6)** — Full brief on each survivor. Inputs: counterparty profile, recent transactions, Specter blob, similar-flags, rule trigger payload. Output: `{headline, body_md, recommended_action, confidence ∈ [0,1]}`.

5. **HITL routing**:
   - `confidence ≥ 0.85` → status=`open`, severity=`info`, badge in **Auto-flagged** tab.
   - `0.5 ≤ confidence < 0.85` → status=`open`, severity=`warn` or `critical`, badge in **Critical** tab. Requires Approve / Dismiss / Investigate.
   - `confidence < 0.5` → suppressed, logged only.

6. **Deep Investigation** (human-triggered) — Click **Investigate further** on any brief → POST `/risk-events/:id/investigate` → backend forwards to Node sidecar → sidecar spawns Cursor Cloud Agent with the brief + Specter blob + a small toolkit (web search, Specter API, Python REPL) → events streamed back to UI in real time → final memo + artifacts persisted to the RiskEvent.

**Visible in UI on every brief:** model used, tokens, latency, confidence. That's the "smart use of LLM models" story made literal.

---

## 7. Rule library (P0)

| ID | Name | Trigger |
|---|---|---|
| R1 | Specter delta | Counterparty headcount drop ≥ 20% in 90d, OR funding round failed, OR negative news flag |
| R2 | Standing exposure breach | Single counterparty (bank) exposure > `max_exposure_pct` |
| R3 | New counterparty | First-ever transaction with a counterparty → enrich + brief |
| R4 | Anomalous payment | Outgoing payment > 3× rolling avg to that counterparty, OR to a counterparty < 6mo old |
| R5 | Customer signal turn (P1) | Receivable counterparty's Specter health flips fragile while they have unpaid invoices |

Rules are pure Python functions over the current state snapshot — no LLM, no I/O. Easy to test, easy to demo determinism.

---

## 8. Specter integration

- **Boot-time:** enrich every seeded counterparty in parallel, cache `profile_json`. Fail-soft: if Specter is down, fall back to canned profiles bundled in the repo so the demo never breaks.
- **Runtime:** when R3 fires, on-demand enrichment with 2s timeout; cache result.
- **Periodic refresh:** every 30 minutes in prod, configurable button in demo (also fired manually by `/demo/trigger/bank-downgrade`).
- **Specter MCP:** if available, the Cursor Cloud Agent gets it as a tool during deep investigation — that's another bonus-point hook.

---

## 9. Multi-model strategy

| Layer | Model | Reason |
|---|---|---|
| Triage | **Anthropic Haiku 4.5** | Cheapest + fastest small model; runs per-event at 5s cadence; good enough to discard noise. |
| Similarity | **OpenAI `text-embedding-3-large`** | Best price/perf for semantic similarity; powers shell-cluster detection. |
| Analyst | **Anthropic Sonnet 4.6** | Strong reasoning + writing in one call; produces the demo's hero artifact (the brief). |
| Investigation | **Cursor SDK cloud agent (composer-2)** | Long-horizon agent with sandboxed tool use, code execution, and artifact output; for forensic dives Sonnet can't do in a single call. |

Each layer is genuinely best-in-class for its job. The UI surfaces this transparently (model badge on every brief; live tool-call stream during investigation).

---

## 10. Backend API

### Read
- `GET /state` — accounts, counterparties, recent risk events, open briefs, summary metrics.
- `GET /counterparties/:id` — full profile + Specter blob + risk history.
- `WS /events/stream` — emits `{counterparty_updated, risk_event_created, brief_ready, transaction_posted, investigation_event}`.

### Demo triggers
- `POST /demo/trigger/bank-downgrade` — flips `neobank_x` health to `fragile`, fires R1.
- `POST /demo/trigger/queue-vendor-payment` — queues $47K to a seeded shell vendor, fires R3+R4.
- `POST /demo/trigger/customer-turn` (P1) — flips a customer's Specter health, fires R5.

### Actions
- `POST /risk-events/:id/escalate` — set status=`escalated`.
- `POST /risk-events/:id/dismiss` — set status=`dismissed`, capture reason.
- `POST /risk-events/:id/resolve` — set status=`resolved`.
- `POST /risk-events/:id/investigate` — proxies to sidecar, returns `investigation_id`; events streamed via WS.

### Sidecar (internal, called by FastAPI only)
- `POST /sidecar/investigate` — `{risk_event_id, brief, specter_blob, toolkit}` → spawns Cursor Cloud Agent, streams events to FastAPI over WS.

---

## 11. Frontend

- **Globe (Mapbox GL, `projection: globe`, dark style).** Every counterparty is a node; size = exposure or txn volume; color = `health_tag`; pulse animation on new RiskEvent; transient line for new transaction.
- **Top bar.** Global exposure score, count of open `critical` events, briefs generated last hour, total LLM spend (visible model meter).
- **Right sidebar — Risk Inbox.** Tabs: `Critical`, `Auto-flagged`, `Resolved`. Cards show headline, counterparty avatar, confidence, model badge, latency. Click → Brief modal.
- **Brief modal.** Markdown body, Specter snapshot, similar-flags list with cosine scores, recommended action, [Approve] [Dismiss] [Investigate Further] buttons.
- **Investigation side panel.** Opens on Investigate. Shows live Cursor agent stream: `thinking`, `tool_call` (with args + result), `task` milestones, final memo. Memo download button when artifact is ready.
- **Demo dock (bottom, behind `?demo=1`).** Three big buttons for the three triggers.

---

## 12. Tech stack & repo layout

**Stack:** Next.js 14 (App Router), Mapbox GL JS, TypeScript, Tailwind, FastAPI, Python 3.11, Postgres 16 + pgvector, Anthropic SDK (Python), OpenAI SDK (Python), Specter client, `@cursor/sdk` (Node 22), Express.

**Repo layout:**
```
/web                # Next.js frontend
/api                # FastAPI backend
  /rules            # rule engine
  /workers          # triage, analyst, embeddings
  /specter          # client + cache
  /simulator        # background activity
/agent-svc          # Node sidecar (Cursor SDK)
/db                 # migrations, seed data
/scripts            # demo triggers, eval harness
/docs               # PRD, design notes
```

**Deploy:** Vercel for web, Render for api + agent-svc + Postgres. Localhost is acceptable for the live demo.

---

## 13. Build allocation (4 people, 48h)

| Owner | Day 1 (24h) | Day 2 (24h) |
|---|---|---|
| **Person A — Backend spine** | FastAPI scaffold, Postgres + migrations, data model, seed data (5 banks, 30 vendors, 20 customers), `/state` endpoint, transaction simulator | WebSocket events, demo trigger endpoints, escalate/dismiss/resolve endpoints |
| **Person B — Risk engine** | Rule engine framework, R1+R2+R3+R4 rules, Haiku triage worker, Sonnet analyst worker, prompts | OpenAI embeddings + pgvector similarity, similar-flags injection into analyst prompt, eval harness |
| **Person C — Frontend** | Next.js scaffold, Mapbox globe, counterparty nodes, top bar, Risk Inbox sidebar, Brief modal | WebSocket client, demo dock, animations (pulse on event, transient line on txn), polish |
| **Person D — Specter + Cursor SDK** | Specter client, boot-time enrichment, canned-profile fallback, seed-data provider profiles | Node sidecar with `@cursor/sdk`, `/investigate` endpoint, event streaming back, Investigation side panel UI wiring |

**Day 2 afternoon (last 6h, all hands):**
- Lock the 90s demo (script, voiceover, screen recording backup).
- Eval pass: run 20 fixture RiskEvents through the pipeline, verify confidences are well-calibrated and briefs read well.
- Polish: empty states, loading states, error toasts, demo banner ("Sandbox — no real money moves").
- Submit.

---

## 14. Scope cuts

### P0 (must ship — by end of day 1)
Globe with seeded nodes; R1+R3+R4 rules; Haiku triage; Sonnet analyst; Specter cache (boot-time); Risk Inbox; Brief modal; two demo triggers; the 90s demo runs end-to-end on localhost.

### P1 (target — ship by end of day 2)
- OpenAI embeddings + similar-flags
- Cursor Cloud Agent investigation (sidecar + UI panel)
- R2 (standing exposure) and R5 (customer turn)
- Third demo trigger (customer)
- Model spend meter
- Auto-reconnecting WebSocket

### P2 (cut, mention in pitch as roadmap)
Auth, multi-tenant, real bank API connectors, persistent storage beyond demo, FX nuance, mobile UI, alerting integrations (Slack/email), historical replay, eval dashboard.

---

## 15. Non-functional & honesty

- **Sandbox banner pinned in UI.** No real bank credentials, no payment rails are touched.
- **Specter graceful degradation.** Demo never breaks if Specter is rate-limited or down — canned profiles ship with the repo.
- **LLM calls fail-soft.** If Sonnet fails, fall back to a templated brief; if Haiku fails, default `keep=true` (over-trigger > miss).
- **No PII in logs.** Counterparty data is fictional; if you accept real Specter data, redact emails/phones.
- **Latency budgets.** Triage <500ms p95; analyst <4s p95; investigation runs in background, no blocking UI.
- **Cost guardrails.** Model spend meter visible; demo budget capped at $5 of API spend.

---

## 16. Stretch ideas if anyone finishes early

- **Voice trigger** for demo: Whisper → "trigger neobank x downgrade" → fires the demo endpoint. Cute, +0.2 demo flair.
- **Eval dashboard:** golden set of 50 RiskEvents with expected severity, confidence calibration plot. Strong with OpenAI judge (Alec Barber) and Briefcase CTO.
- **Cursor SDK MCP toolkit:** expose Specter MCP + a custom "treasury policy lookup" MCP to the Cloud Agent. Makes the investigation richer.
- **One-line "what changed" timeline** on every counterparty profile — generated by Sonnet from RiskEvent history.

---

## 17. References

- Track 02 brief: cursor-hack-london-2026-1.vercel.app — *"Agents that read and interpret money"*
- Cursor SDK docs: https://cursor.com/docs/api/sdk/typescript
- Cursor SDK cookbook: https://github.com/cursor/cookbook
- Specter API: per-team Discord onboarding (ping Francisco)
- Anthropic SDK: https://docs.anthropic.com
- OpenAI embeddings: https://platform.openai.com/docs/guides/embeddings
- Mapbox GL JS globe projection: https://docs.mapbox.com/mapbox-gl-js

---

*Last updated: 2026-04-30. Single source of truth for the build. PRs welcome — keep this file current.*
