# Globe Specter hover popup — design

Date: 2026-04-30
Component: `web/components/Globe.tsx`
Status: spec for implementation

## Goal

When a user hovers a counterparty dot on the globe, surface the company information and financials already pulled by Specter (carried on `Counterparty.profile_json`). Clicking a dot pins the popup so the user can read the financials without keeping the cursor on a single pixel.

## Why this is small

The data already lives on each `Counterparty` (`profile_json: SpecterProfile | null`) returned by `/state` and updated via the `counterparty_updated` WebSocket event. There is no new API call, no new state lifted to `app/app/page.tsx`, and no new dependency. The change is fully contained inside `Globe.tsx`'s `style.load` handler plus a small `useRef` for the live counterparties list.

## Behavior

| Trigger | Pinned state | Effect |
|---|---|---|
| Mouseenter `cp-dot` | none | Show popup (hover mode, no `×`) |
| Mouseleave `cp-dot` | none | Remove popup |
| Mouseenter `cp-dot` | yes | No-op (pinned popup wins) |
| Click `cp-dot` (different from pinned, or none pinned) | any | Pin popup at that dot, render with `×` |
| Click `cp-dot` (already pinned) | self | Unpin and remove |
| Click `×` inside popup | yes | Unpin and remove |
| Click on map background (no dot) | yes | Unpin and remove |

## Popup content

Rendered as an HTML string passed to `mapboxgl.Popup#setHTML`, matching the existing pattern. Width ~300px, `maxWidth: "320px"`.

```
┌──────────────────────────────────────┐
│ Acme Holdings              [stable]  │
│ vendor · UK · Stripe                 │
├──────────────────────────────────────┤
│ Headcount        342   ▲ +12% (90d)  │
│ Last funding     $25M · Aug 2024     │
│ Incorporated     2017                │
├──────────────────────────────────────┤
│ INVESTORS                            │
│ Sequoia · a16z · Index               │
├──────────────────────────────────────┤
│ ⚠ NEWS FLAGS                         │
│ CFO departure (2026-04-12)           │
│ Layoffs announced 2026-04-25         │
├──────────────────────────────────────┤
│ acme.com  ·  London, UK              │
└──────────────────────────────────────┘
```

### Field rules

- **Header**: `cp.name` left, health chip right using `COLOURS[cp.health_tag]` as background tint with paper text. Subline: `cp.type · cp.region · cp.provider`, separator `·` in `--paper-dim`.
- **Headcount row**: always shown when `profile_json` is present. The 90d delta uses `▲` (green `#86a99a`) for non-negative, `▼` (crit `#d97757`) for negative. Format delta as `+12%` / `-15%`, integer-rounded.
- **Last funding**: hidden if both `last_funding_round_date` and `last_funding_round_amount_musd` are null. Amount formatted as `$NM` (integer M when whole, one decimal otherwise). Date formatted as `Mon YYYY` from `last_funding_round_date` (ISO).
- **Incorporated**: if `incorporated` matches `/^(\d{4})/`, show the captured 4-digit year; otherwise show the raw string verbatim (the Specter client falls back to `"unknown"` when no date is available — show that string as-is).
- **Investors**: hidden if empty. Joined with ` · `. If more than 4, truncate to first 4 and append `+N more`.
- **News flags**: hidden if empty. Each flag rendered as a chip in `--crit` color. Section header uses `⚠ NEWS FLAGS` in crit. Flag values are prose strings from Specter (e.g. `"CFO departure (2026-04-12)"`, `"Layoffs announced 2026-04-25"`); render verbatim, no parsing.
- **Footer**: website (rendered as a link if non-null, opens in new tab) and address joined with `  ·  ` in `--paper-dim`. Hide footer entirely if both are missing.

### Null `profile_json` fallback

If `cp.profile_json === null`, render the header section only plus a single muted line: `No Specter profile`. Never hide the popup — the dot still represents a known counterparty.

## Styling

Inline styles on the popup HTML (current pattern in `Globe.tsx:145`). Use the actual project Tailwind tokens (from `web/tailwind.config.ts`) so the popup matches the brass/paper aesthetic of the rest of the app — note that the existing hover popup in `Globe.tsx` uses pre-redesign hex values (`#11151c`, `#1f242c`, `#e5e7eb`, `#9ca3af`); the new popup intentionally diverges to the current palette:

| Token | Hex | Use |
|---|---|---|
| panel | `#0f141b` | popup background |
| ink | `#1a2029` | inset rows (e.g., facts grid stripe), chip backgrounds at low opacity |
| border | `#23303d` | popup border, section dividers |
| muted | `#5a6677` | very faint text, separator dots |
| paper | `#ece2c9` | primary text |
| paper-dim | `#b8ad94` | labels, secondary text |
| accent | `#c9a86e` | website link |
| ok | `#86a99a` | non-negative headcount delta arrow + value |
| warn | `#d8a85b` | (reserved — not used in this popup) |
| crit | `#d97757` | negative headcount delta + news flag chips |

Health chip colors stay aligned with the existing `COLOURS` map at `Globe.tsx:7-11` (`stable: #86a99a`, `watch: #d8a85b`, `fragile: #d97757`) so the chip color matches the dot color exactly.

Font stack: `ui-monospace, Menlo, monospace` for labels and tabular numbers; default sans for body text. Border radius `6px`. Section dividers: `1px solid #23303d` between header / facts / investors / news / footer.

The pinned `×` is a 16px button absolutely positioned top-right of the popup, color `--paper-dim`, hover `--paper`. It uses `data-cp-popup-close="1"` so a delegated click listener on the popup element handles the click.

## Implementation sketch

In `Globe.tsx`, inside the existing `style.load` handler (replacing the current `mouseenter`/`mouseleave` block at lines 136-151):

```ts
// Outside the effect, near the top of the component:
const counterpartiesRef = useRef<Counterparty[]>(counterparties);
useEffect(() => { counterpartiesRef.current = counterparties; }, [counterparties]);

// Inside style.load:
const popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false,
  className: "radar-popup",
  maxWidth: "320px",
  offset: 12,
});
let pinnedId: string | null = null;

const findCp = (id: string) =>
  counterpartiesRef.current.find((c) => c.id === id) ?? null;

const buildHTML = (cp: Counterparty, pinned: boolean): string => {
  // pure function — see "Field rules" above for content
};

const showPopup = (cp: Counterparty, lngLat: [number, number], pinned: boolean) => {
  popup.setLngLat(lngLat).setHTML(buildHTML(cp, pinned)).addTo(map);
};

map.on("mouseenter", "cp-dot", (e) => {
  if (pinnedId) return;
  map.getCanvas().style.cursor = "pointer";
  const f = e.features?.[0]; if (!f) return;
  const cp = findCp(f.properties.id); if (!cp) return;
  showPopup(cp, (f.geometry as any).coordinates, false);
});

map.on("mouseleave", "cp-dot", () => {
  map.getCanvas().style.cursor = "";
  if (pinnedId) return;
  popup.remove();
});

map.on("click", "cp-dot", (e) => {
  const f = e.features?.[0]; if (!f) return;
  const id = f.properties.id;
  if (pinnedId === id) {
    pinnedId = null;
    popup.remove();
    return;
  }
  const cp = findCp(id); if (!cp) return;
  pinnedId = id;
  showPopup(cp, (f.geometry as any).coordinates, true);
});

map.on("click", (e) => {
  if (!pinnedId) return;
  const hits = map.queryRenderedFeatures(e.point, { layers: ["cp-dot"] });
  if (hits.length === 0) {
    pinnedId = null;
    popup.remove();
  }
});

// Delegated × handler — runs on every popup open.
popup.on("open", () => {
  const el = popup.getElement();
  el?.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement | null;
    if (t?.closest('[data-cp-popup-close="1"]')) {
      pinnedId = null;
      popup.remove();
    }
  });
});
```

### Live data while pinned

When a `counterparty_updated` WebSocket event mutates the pinned counterparty (e.g., health tag flip during a demo), the popup currently does NOT auto-refresh — its HTML is set once on open. This is acceptable for the hackathon scope. If we want it to refresh, we'd add a second effect that re-calls `setHTML` while `pinnedId` matches a changed `cp.id`. Out of scope for this change.

## Out of scope

- No new API call. `profile_json` is already on the prop.
- No React-tree popup body (HTML strings only — same as today).
- No mobile / touch tuning. Hover behavior on touch falls through to click-to-pin, which is acceptable.
- Live re-render of pinned popup on `counterparty_updated` (see note above).
- No changes to `RiskInbox`, `TopBar`, `BriefModal`, or any other component.

## Files touched

- `web/components/Globe.tsx` — extend `style.load` handler, add `counterpartiesRef`, replace existing hover popup block.

## Acceptance criteria

1. Hovering a counterparty dot shows a popup with the rich Specter card described above. Mouseleave closes it.
2. Clicking a counterparty dot pins the popup; mouseleave no longer closes it; the `×` button is visible.
3. Clicking the pinned dot again, the `×`, or empty map background unpins and removes the popup.
4. Clicking a different dot while pinned moves the pin to that dot.
5. Counterparties with `profile_json === null` show the minimal fallback card with `No Specter profile`.
6. Long investor lists are truncated to 4 + "+N more". Empty investor / news_flags sections are hidden entirely.
7. The negative-headcount-delta arrow renders in crit; non-negative renders in stable.
8. The existing globe layers (`cp-halo`, `cp-dot`, `flow-line`), pulse animation, and flow animation remain unchanged.
