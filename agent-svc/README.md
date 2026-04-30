# agent-svc/ — Node sidecar (Cursor SDK)

**Owner: D.**

Tiny Express service that owns all `@cursor/sdk` calls. The Python backend POSTs `/investigate`; we spawn a Cursor Cloud Agent and stream events back.

## Quickstart
```bash
npm install
npm run dev   # http://localhost:8001/health
```

Without `CURSOR_API_KEY` it returns a fake event stream so the rest of the team can build the UI panel.

## Cursor config

- `CURSOR_API_KEY` enables the live Cloud Agent path.
- Without `CURSOR_API_KEY`, `/investigate` emits the same event shape via a deterministic fallback stream.
- `CURSOR_REPO_URL` is optional. If set, the Cloud Agent runs with that connected repo and `CURSOR_STARTING_REF` (default `main`). If unset, the SDK uses a generic cloud environment.
- `CURSOR_MODEL` is optional; leave blank to use the Cursor account default.

## Cursor SDK refs
- Quickstart: https://github.com/cursor/cookbook/tree/main/sdk/quickstart
- Docs: https://cursor.com/docs/api/sdk/typescript
