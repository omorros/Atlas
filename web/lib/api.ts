import type { StateResponse } from "./types";
import fixtures from "../../shared/fixtures.json";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchState(): Promise<StateResponse> {
  try {
    const r = await fetch(`${API}/state`, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as StateResponse;
  } catch {
    return offlineState();
  }
}

export async function trigger(name: "bank-downgrade" | "queue-vendor-payment" | "customer-turn") {
  return fetch(`${API}/demo/trigger/${name}`, { method: "POST" });
}

export async function escalate(eventId: string) {
  return fetch(`${API}/risk-events/${eventId}/escalate`, { method: "POST" });
}

export async function dismiss(eventId: string) {
  return fetch(`${API}/risk-events/${eventId}/dismiss`, { method: "POST" });
}

export async function investigate(eventId: string) {
  return fetch(`${API}/risk-events/${eventId}/investigate`, { method: "POST" });
}

// Offline mode: when api/ is down, render fixture data so the UI is still usable.
function offlineState(): StateResponse {
  return {
    counterparties: fixtures.counterparties as any,
    accounts: fixtures.accounts as any,
    recent_transactions: fixtures.transactions as any,
    open_risk_events: [],
    recent_briefs: [],
    metrics: {
      total_cash_base: 0,
      global_runway_months: 0,
      largest_provider_exposure_pct: 0,
      open_critical_count: 0,
      briefs_last_hour: 0,
      llm_spend_usd: 0,
      daily_burn_calibrated_usd: 0,
      observed_daily_outflow_usd: 0,
    },
  };
}
