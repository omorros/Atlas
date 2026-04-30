Product Requirements Document
Global Liquidity War Room
1. Overview
Product name
Global Liquidity War Room

One‑liner
A real‑time treasury control room that visualises cash across banks and regions on a Mapbox globe and uses an agent to rebalance balances within explicit risk and runway policies.

Vision

Treasury teams are moving from batch reports and spreadsheets to real‑time liquidity visibility and API‑driven control. In this product:

All relevant accounts are visible on a single interactive map.

A simple, configurable policy encodes “how safe” cash distribution should be (runway, concentration caps).

An agent continuously checks balances and flows, proposes or executes transfers, and explains its actions in plain language.

The initial version operates in a sandbox with simulated balances and flows, but the architecture is designed so that bank or TMS APIs can be wired in later without changing the core logic.

2. Objectives
Primary objective

Demonstrate an end‑to‑end, working treasury “war room” where an autonomous agent maintains basic liquidity and concentration policies over a set of accounts, with a clear human‑in‑the‑loop for large moves.

Secondary objectives

Showcase a high‑fidelity Mapbox GL JS map as the primary interface.

Integrate Specter for enriched information about selected institutions (for example neobanks, yield platforms), used to influence caps or explain decisions.

Make the system architecture clean enough that replacing simulated balances with real‑time bank or TMS data is straightforward.

3. Users and use cases
Primary user

Treasury manager or finance lead in a mid‑market company (50–500 staff) with multiple accounts across banks and regions.

Core use cases

Global liquidity at a glance

See where cash sits across accounts, banks and regions on a single map, plus high level metrics (global runway, largest single‑bank exposure).

Automatic enforcement of basic policies

Encode simple rules like “no more than 30 percent of cash at any one provider” and “at least 30 days runway in each region”.

Let an agent continuously maintain these by proposing or running transfers.

Respond to events and shocks

When a provider is flagged as higher risk or a large outgoing payment hits, watch the system adjust allocations to restore policy as far as possible.

Explainability and control

For each agent‑initiated transfer, see what changed, which rule fired, and what the alternative options were.

Approve or reject high‑impact transfers before they are applied.

4. Data model
Everything in this version runs in a sandbox: accounts, balances and transactions are stored and updated by the backend and never reach real bank rails.

4.1 Accounts
Entity: Account

id (string)

name (string) – descriptive label (“MainBank UK – Operating”)

provider (string) – logical bank or platform identifier (mainbank_uk, neobank_x, yield_y)

type (enum) – operating | reserve | yield

region (enum) – UK | EU | US | APAC (start with a small fixed set)

currency (string) – ISO code (GBP, EUR, USD)

lat / lng (float) – coordinates for Mapbox

balance (number) – current balance in account currency

Initial seed:

“MainBank UK – Operating” (London, GBP)

“MainBank EU – Operating” (Frankfurt, EUR)

“MainBank US – Operating” (New York, USD)

“Neobank X – Multi‑currency” (London or Berlin, choose one location)

“YieldPlatform Y – Liquidity Fund” (Luxembourg)

Balances are initialised to realistic values (for example low to mid seven figures).

4.2 Transactions
Two categories:

Scheduled outgoing payments

id

from_account_id

amount (number)

currency (string)

execution_time (timestamp)

description (string)

These reduce balances at execution_time and simulate normal business activity.

Agent transfers

id

from_account_id

to_account_id

amount (number)

currency (string)

created_at (timestamp)

status (enum) – auto_executed | pending_approval | rejected

reason (string) – explanation of why this transfer is recommended or executed

approved_by (string | null) – user identifier if approved

Agent transfers update balances only when status is auto_executed or approved.

5. Policy model
Represent key treasury policies as structured configuration.

5.1 Global policy
min_global_runway_months – e.g. 12

base_fx_rates – mapping from currency to an implied base (for simple conversion; for example 1 GBP = 1.25 USD, 1 EUR = 1.1 USD)

5.2 Regional policy
min_runway_days_per_region – object keyed by region, e.g.:

json
{
  "UK": 30,
  "EU": 30,
  "US": 30,
  "APAC": 30
}
5.3 Concentration policy
max_exposure_pct_per_provider – object keyed by provider, for example:

json
{
  "mainbank_uk": 0.4,
  "mainbank_eu": 0.4,
  "mainbank_us": 0.4,
  "neobank_x": 0.25,
  "yield_y": 0.15
}
5.4 Provider health (via Specter)
Optional but recommended:

provider_health – object keyed by provider with tags derived from Specter enrichment for a couple of providers:

neobank_x: fragile (small headcount, limited funding).

yield_y: stable or fragile depending on retrieved data.

Map fragile providers to lower max_exposure_pct_per_provider and show this in the UI.

6. Agent behaviour
Agent loop runs on a timer (for example every 5 seconds in the demo; would be slower in production).

6.1 Compute derived state
At each cycle:

Fetch accounts and scheduled payments

Retrieve all accounts and their balances.

Retrieve any scheduled payments due within the next time window (for example next hour) for display.

Normalise to base currency

Using base_fx_rates, compute a base currency equivalent balance per account.

Sum to get total cash.

Global metrics

Assume a simple global daily net burn (configured per region or globally).

Compute global runway:

global_runway_months
=
total_cash_base
global_daily_burn
×
30
global_runway_months= 
global_daily_burn×30
total_cash_base
​
 
Regional metrics

For each region:

Sum base‑converted balances of accounts in that region.

Compute runway days:

runway_days_region
=
regional_cash_base
regional_daily_burn
runway_days_region= 
regional_daily_burn
regional_cash_base
​
 
Exposure metrics

For each provider:

Sum balances (base currency) in accounts of that provider.

Compute exposure percentage:

exposure_pct
=
provider_cash_base
total_cash_base
exposure_pct= 
total_cash_base
provider_cash_base
​
 
6.2 Detect policy breaches
Flag:

Any provider where exposure_pct > max_exposure_pct_per_provider[provider].

Any region where runway_days_region < min_runway_days_per_region[region].

Global runway below min_global_runway_months.

6.3 Plan transfers
Given breaches, agent computes recommended transfers. Start with a simple greedy algorithm:

Reduce provider concentration

For each over‑exposed provider:

List that provider’s accounts sorted by balance descending.

List destination accounts from other providers sorted by available headroom (max_exposure_pct_per_provider - current_exposure).

For each over‑exposed account:

Compute the amount to move such that exposure falls just below the cap, subject to not sending balances negative.

Allocate that amount across destination accounts according to headroom.

Emit proposed transfers accordingly.

Fix regional runway

For each region below minimum runway:

List donor regions with runway well above minimum.

Within donors, pick accounts with largest balances at safe providers.

Propose transfers from donor accounts to accounts in the underfunded region until regional runway reaches minimum or donor runway would fall below its own minimum.

In v1, ignore complex FX; either keep transfers within currency or assume FX can happen at the same notional value.

6.4 Decide execution vs approval
For each proposed transfer:

If amount <= auto_transfer_threshold (for example 50,000 in base currency) → mark auto_executed.

Else → pending_approval.

Auto‑executed transfers:

Immediately update balances in the database.

Save an Agent transfer record with status = "auto_executed" and a textual reason.

Broadcast an event to frontend.

Pending approvals:

Save a transfer record with status = "pending_approval".

Broadcast an event so the frontend can display it in a “Pending decisions” panel.

Apply only when a human calls the approval endpoint.

7. Specter integration (optional enrichment)
To make provider health tangible:

For selected providers (for example Neobank X and YieldPlatform Y), call Specter:

Text search endpoint to find the company by name or domain.

Enrichment endpoint to get company profile: funding rounds, headcount, investor data.

From Specter data, derive:

Simple health tag: stable vs fragile.

Short description string for the UI.

Use:

health to set or modify max_exposure_pct_per_provider for that provider (for example lower cap for fragile providers).

Description in the node detail panel so users see why caps differ.

In the initial build, you can call Specter once at startup for these providers and cache the result.

8. Backend API
All operations stay within the sandbox; no external financial transfers.

Endpoints (example)

GET /state

Returns:

List of accounts with current balances.

Global and regional metrics (runway, exposures).

List of recent agent actions.

List of pending transfers.

GET /events/stream (WebSocket or SSE)

Streams state changes:

Metric updates.

New agent actions (planned transfers).

Approval / rejection updates.

POST /events/large-payment

Accepts JSON { from_account_id, amount, currency, description }.

Immediately reduces that account’s balance and logs a scheduled payment event, triggering agent response.

POST /events/provider-risk

Accepts JSON { provider, level } (for example mark provider as fragile).

Updates provider health and, if configured, its exposure cap.

Triggers agent loop.

POST /transfers/:id/approve

Marks a pending transfer as auto_executed, sets approved_by, updates balances, emits event.

POST /transfers/:id/reject

Marks a pending transfer as rejected, records reason, emits event.

Optional: GET /providers/:id/specter

Returns cached Specter metadata for displaying in UI.

9. Frontend: Mapbox‑driven UI
Built with React / Next.js and Mapbox GL JS.

9.1 Map initialisation
Initialise Mapbox with:

Dark theme style (for example mapbox://styles/mapbox/standard with modified colours).

projection: "globe" for a subtle 3D feel.

Camera centred somewhere mid‑Atlantic with a low zoom so all nodes are visible.

Disable scroll zoom (nicer UX), add basic navigation controls.

9.2 Accounts layer
Keep a GeoJSON source with all accounts.

Render with a circle layer:

circle-radius: data‑driven, for example 3 + log10(balance) clipped to a reasonable range.

circle-color: determined by provider or risk.

circle-stroke-color: emphasise risky providers (for example red halo if flagged).

When account balances update, update the source and let Mapbox re‑render.

9.3 Transfers visualisation
When a transfer event arrives:

Add a LineString feature between from and to coordinates to a transient flows source.

Animate:

Either by fading the line’s opacity over a short period, or

By moving a small marker along the line using a timer.

Consider using a different colour for auto‑executed vs pending / approved transfers.

9.4 Panels and interactions
Top bar

Global runway in months (colour coded).

Largest provider exposure percent.

Number of auto actions taken over the last period.

Right sidebar

Tab 1: Recent actions – list of agent transfers with:

Time, from → to, amount, reason.

Tab 2: Pending approvals – cards with:

From → to, amount, which policy is being corrected, Approve / Reject buttons.

Account details

Clicking a node opens a panel:

Account name, provider, region, currency, balance.

Provider exposure.

If the provider has Specter data, a short profile (size, funding, headline).

10. Non‑functional requirements
No real financial credentials or external payment APIs are used.

Application must run reliably on a single machine with intermittent internet (Mapbox tiles, optional Specter).

Clear language in the UI that this is a sandbox environment for visualising and testing treasury policies.

11. Implementation priorities for the coding agent
P0 – Minimum viable demo

Backend with in‑memory or simple DB state for accounts, policies, and transfers.

Agent loop that:

Computes metrics.

Detects exposures and runway breaches.

Proposes transfers.

Applies auto‑executed transfers and exposes pending ones.

Mapbox map showing accounts and metrics.

Basic flows animation and action list.

P1 – Strong hackathon version

WebSocket/SSE for live updates.

Pending approvals with Approve / Reject.

Provider risk event endpoint and UI button to trigger a “Neobank X downgraded” scenario.

Optional Specter integration for one or two providers (cached).

P2 – After the event

Replace simulated balances with pluggable connectors to real bank / TMS APIs.

Add user management and stronger governance for approval workflows.

Enhance FX handling and introduce FX constraints.

This PRD gives your coding agent a precise domain model, agent behaviour, API surface and UI description, while remaining honest about the current sandboxed nature of the data. It is close in spirit to the real‑time, API‑driven, agentic treasury systems being discussed for 2026.
