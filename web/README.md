# web/ — Next.js frontend

**Owner: C.**

## Quickstart
```bash
npm install
npm run dev   # http://localhost:3000
```

The page boots even without the API or a Mapbox token — fixtures render in offline mode and the globe shows a hint to add the token.

## Get a Mapbox token (free)
1. https://account.mapbox.com/access-tokens
2. Sign up, create a public token, paste into `web/.env` as `NEXT_PUBLIC_MAPBOX_TOKEN`.

## What's wired vs TODO
| File | Status |
|---|---|
| `app/page.tsx` — main shell | ✅ wired |
| `components/Globe.tsx` — Mapbox globe with seeded markers | ✅ wired (markers; circle-layer + animations TODO) |
| `components/TopBar.tsx` — metrics | ✅ wired |
| `components/RiskInbox.tsx` — sidebar | ✅ wired (tab filtering TODO) |
| `components/BriefModal.tsx` — modal | ✅ wired (Markdown rendering TODO — currently `<pre>`) |
| `components/DemoDock.tsx` — three triggers | ✅ wired |
| `components/InvestigationPanel.tsx` — Cursor agent stream | ✅ shell, needs WS wiring |
| `lib/api.ts`, `lib/ws.ts` — backend client | ✅ wired with offline fallback + WS reconnect |

## TODOs for C
- Replace per-marker DOM with a circle-layer + GeoJSON source for perf and pulse animations on `risk_event_created`.
- Render `body_md` as proper markdown in the modal (`react-markdown` or similar).
- Tab filtering in RiskInbox.
- Wire InvestigationPanel to a `useWS({ investigation_event })` handler.
