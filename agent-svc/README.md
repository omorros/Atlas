# agent-svc/ — Node sidecar (Cursor SDK)

**Owner: D.**

Tiny Express service that owns all `@cursor/sdk` calls. The Python backend POSTs `/investigate`; we spawn a Cursor Cloud Agent and stream events back.

## Quickstart
```bash
npm install
npm run dev   # http://localhost:8001/health
```

Without `CURSOR_API_KEY` it returns a fake event stream so the rest of the team can build the UI panel.

## TODOs for D
1. Get a Cursor API key (see root README — Integrations dashboard, format `crsr_...`).
2. Implement the actual `@cursor/sdk` call in `src/investigate.ts` (TODO block is in place).
3. Add `/internal/investigation-events` endpoint to FastAPI (or pick a different forward channel) so streamed events fan out to WS clients.
4. Decide: cloud agent against an empty repo, or against this repo? Empty is simpler; this repo gives the agent more context but more risk.

## Cursor SDK refs
- Quickstart: https://github.com/cursor/cookbook/tree/main/sdk/quickstart
- Docs: https://cursor.com/docs/api/sdk/typescript
