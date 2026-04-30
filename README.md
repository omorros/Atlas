# Counterparty Risk Radar

**Cursor × Briefcase London 2026 — Track 02: Financial Intelligence**

A real-time treasury intelligence control room. The agent reads transactions and standing exposures across banks, vendors, and customers; enriches every counterparty via Specter; scores risk through a hybrid rule + multi-model LLM pipeline; and surfaces written briefs into a Mapbox war-room UI. Humans decide. **The agent never moves money.**

> Full product spec: [`PRD.md`](./PRD.md). Read this before touching code.

---

## Quickstart (5 minutes)

### 1. Prereqs
- **Node.js 22+** (for `web/` and `agent-svc/`)
- **Python 3.11+** (for `api/`)
- **Git**

### 2. Clone & install
```bash
git clone <repo-url> Cursor-hack
cd Cursor-hack
npm install              # root, brings in concurrently
npm --prefix web install
npm --prefix agent-svc install
pip install -r api/requirements.txt
```

### 3. Add your keys
Each `.env` file is gitignored and pre-created with empty values. Open and fill:
- `./.env` (root — shared)
- `api/.env` (backend)
- `web/.env` (frontend — needs `NEXT_PUBLIC_MAPBOX_TOKEN`)
- `agent-svc/.env` (sidecar — needs `CURSOR_API_KEY`)

**Without keys, the system runs in fallback mode** (canned Specter, fallback briefs, fake investigation events). Useful for offline dev. See [API keys](#api-keys) below.

### 4. Run everything
```bash
npm run dev
```

This spawns three processes via `concurrently`:
| service | port | url |
|---|---|---|
| api (FastAPI) | 8000 | http://localhost:8000/health |
| web — landing | 3000 | http://localhost:3000 |
| web — war room | 3000 | http://localhost:3000/app |
| agent-svc (Express) | 8001 | http://localhost:8001/health |

### 5. Run the demo from CLI
```bash
npm run demo:bank      # beat 1
npm run demo:vendor    # beat 2
npm run demo:customer  # beat 3 (P1)
```

Or click the buttons in the **Demo Dock** at the bottom of the UI.

---

## Repo layout

```
PRD.md                          # The spec. Read first.
README.md                       # You are here.
package.json                    # Root: concurrently dev script.
.env                            # Root keys (gitignored, pre-created).
shared/
  fixtures.json                 # Seed data: counterparties, accounts, transactions, Specter profiles.
  types.ts                      # TS contracts (frontend + sidecar).
  schemas.py                    # Pydantic mirror (backend).
api/                            # FastAPI backend - Owners A + B
  app/
    main.py                     # Entrypoint
    config.py                   # Settings + .env loader
    db.py                       # SQLAlchemy models (SQLite + JSON cols)
    seed.py                     # Loads fixtures into SQLite on first boot
    events.py                   # In-process EventBus for WS fan-out
    simulator.py                # Background txn generator (A)
    routers/
      state.py                  # GET /state with metrics calc
      demo.py                   # POST /demo/trigger/* (3 buttons)
      risk_events.py            # escalate/dismiss/resolve/investigate
      ws.py                     # WS /events/stream
    rules/                      # Rule engine - Owner B
      base.py
      r1_specter_delta.py
      r3_new_counterparty.py
      r4_anomalous_payment.py
    workers/                    # LLM workers - Owner B
      triage.py                 # Anthropic Haiku 4.5
      analyst.py                # Anthropic Sonnet 4.6
      embeddings.py             # OpenAI text-embedding-3-large + cosine
    specter/                    # Owner D
      client.py
web/                            # Next.js frontend - Owner C
  app/page.tsx                  # Main shell
  components/
    Globe.tsx                   # Mapbox globe
    TopBar.tsx                  # Metrics
    RiskInbox.tsx               # Sidebar
    BriefModal.tsx              # Brief detail
    DemoDock.tsx                # 3 trigger buttons
    InvestigationPanel.tsx      # Live Cursor agent stream
  lib/{api.ts, ws.ts, types.ts}
agent-svc/                      # Node sidecar (Cursor SDK) - Owner D
  src/
    index.ts                    # Express + /investigate
    investigate.ts              # Cursor SDK glue
```

---

## Owners (4 people, 48h)

| Owner | Files | Goal |
|---|---|---|
| **A — Backend spine** | `api/app/main.py`, `db.py`, `seed.py`, `routers/*.py`, `simulator.py`, `events.py` | Already wired. Polish: hook simulator into `main.py` lifespan; add `/internal/investigation-events` endpoint; track LLM spend in metrics. |
| **B — Risk engine** | `api/app/rules/*.py`, `api/app/workers/*.py` | Implement R1, R3, R4 rule logic. Wire Haiku triage and Sonnet analyst real calls. Implement OpenAI embeddings + similar-flags injection. Boot the engine in `main.py` lifespan. |
| **C — Frontend** | `web/**` | Globe is rendering markers — upgrade to circle layer + GeoJSON for pulse animations. Render `body_md` as proper markdown. Tab filtering. WS-driven InvestigationPanel. Polish. |
| **D — Specter + Cursor SDK** | `api/app/specter/client.py`, `agent-svc/**` | Wire Specter REST. Boot-time enrichment on startup. Wire `@cursor/sdk` in `agent-svc/src/investigate.ts` for real cloud agents. Forward investigation events back to FastAPI → WS clients. |

`grep -rn "TODO" .` to see your tickets.

---

## API keys

All four are optional for local dev — the app runs with fallbacks if missing. But you'll want each for the demo:

### 1. Mapbox (free, takes 60 seconds) — for Person C
- Sign up: https://account.mapbox.com/auth/signup/
- Create token: https://account.mapbox.com/access-tokens/ → "Create a token" → keep default scopes
- Paste into `web/.env` as `NEXT_PUBLIC_MAPBOX_TOKEN`
- Free tier: 50k loads/month, way more than enough.

### 2. Anthropic (Claude — Haiku + Sonnet) — risk engine (triage + analyst briefs)
- Sign up / log in: https://console.anthropic.com
- Create key: Settings → API Keys → "Create Key"
- Paste into `api/.env` and root `.env` as `ANTHROPIC_API_KEY`
- Add ~$5 of credits, more than enough for the hack.
- Models we use: `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`.

### 3. OpenAI (embeddings only) — risk engine (similar-flags / shell proximity)
- Sign up / log in: https://platform.openai.com
- Create key: https://platform.openai.com/api-keys → "Create new secret key"
- Paste into `api/.env` and root `.env` as `OPENAI_API_KEY`
- We only use `text-embedding-3-large`. Trivial spend.

### 4. Specter (sponsor) — for Person D
- This is **the sponsor**. Ping **Francisco on the hackathon Discord** for access (referenced on the event page: "Best use of Specter — Ping Francisco for access on Discord").
- Confirm whether you'll get a regular API key, an MCP endpoint, or both.
- Paste into `api/.env` and root `.env` as `SPECTER_API_KEY`. If MCP-only, ask Francisco for the MCP URL and we'll wire it for the Cursor cloud agent.

### 5. Cursor SDK (key + access) — for Person D
**This is what you asked about.** Two ways:

**a) The hackathon prize bucket gives you SDK access.** The event page lists "Best use of Cursor — $100 credits to be shared on Discord + Cursor SDK". Check the hackathon Discord — the organisers usually drop a code/instructions for participants.

**b) Direct key from your Cursor account:**
1. Make sure you're on a paid Cursor plan (Pro or higher) — SDK access is gated.
2. Open https://cursor.com → Settings → **Integrations** → look for "API Keys" or "SDK".
3. If the dashboard doesn't show it yet (the SDK is recent), apply at https://cursor.com/sdk or check the announcement post linked from the cookbook: https://github.com/cursor/cookbook
4. Format will be `crsr_...`. Paste into `agent-svc/.env` as `CURSOR_API_KEY`.

If you can't get a key in time, the sidecar runs a **simulated investigation** (fake event stream) so the rest of the team can build against it. The demo will work either way.

**Cursor SDK refs:**
- Cookbook: https://github.com/cursor/cookbook
- Quickstart example: https://github.com/cursor/cookbook/tree/main/sdk/quickstart
- Docs: https://cursor.com/docs/api/sdk/typescript

---

## Workflow

```bash
# Branch per owner
git checkout -b feat/A-simulator
git checkout -b feat/B-rules
git checkout -b feat/C-globe-pulses
git checkout -b feat/D-cursor-sdk

# Find your tickets
grep -rn "TODO(A)" .   # or B, C, D

# Daily merge to main, no PR ceremony - it's a hack
```

Default to small commits and frequent pulls so the four branches don't drift.

---

## Reset / debug

```bash
# Wipe local DB and reseed
rm api/data/radar.db && cd api && python -m app.seed

# Just the backend
npm run dev:api

# Just the frontend
npm run dev:web

# Just the sidecar
npm run dev:svc

# Smoke test the API
curl http://localhost:8000/health
curl http://localhost:8000/state | jq
curl -X POST http://localhost:8000/demo/trigger/bank-downgrade
```

---

## Demo (90s)
See [`PRD.md`](./PRD.md) §2 — bank run → mystery vendor.

---

## License
Hackathon project — all rights reserved until further notice.
