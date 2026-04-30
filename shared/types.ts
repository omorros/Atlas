// Shared type contracts. Mirror of shared/schemas.py.
// If you change this file, also update schemas.py to keep backend + frontend in sync.

export type Region = "UK" | "EU" | "US" | "APAC";
export type CounterpartyType = "bank" | "vendor" | "customer";
export type HealthTag = "stable" | "watch" | "fragile";
export type Direction = "in" | "out";
export type TxStatus = "scheduled" | "posted" | "queued_for_approval";
export type RiskEventStatus = "open" | "escalated" | "dismissed" | "resolved";
export type Severity = "info" | "warn" | "critical";
export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5";

export interface Counterparty {
  id: string;
  name: string;
  type: CounterpartyType;
  provider: string;
  region: Region;
  lat: number;
  lng: number;
  specter_id: string | null;
  health_tag: HealthTag;
  max_exposure_pct: number;
  profile_json?: SpecterProfile | null;
}

export interface Account {
  id: string;
  counterparty_id: string;
  name: string;
  currency: string;
  balance: number;
  region: Region;
}

export interface Transaction {
  id: string;
  direction: Direction;
  counterparty_id: string;
  account_id: string;
  amount: number;
  currency: string;
  status: TxStatus;
  description: string;
  occurred_at: string; // ISO 8601
}

export interface SpecterProfile {
  company: string;
  headcount: number;
  headcount_delta_90d_pct: number;
  last_funding_round_date: string | null;
  last_funding_round_amount_musd: number | null;
  investors: string[];
  news_flags: string[];
  incorporated: string;
  website: string | null;
  address: string;
}

export interface RiskEvent {
  id: string;
  counterparty_id: string;
  trigger_rule: RuleId;
  trigger_payload: Record<string, unknown>;
  raw_score: number;
  llm_confidence: number;
  severity: Severity;
  status: RiskEventStatus;
  created_at: string;
}

export interface SimilarFlag {
  counterparty_id: string;
  name: string;
  cosine_sim: number;
  flagged_at: string;
}

export interface Brief {
  id: string;
  risk_event_id: string;
  headline: string;
  body_md: string;
  recommended_action: string;
  specter_snapshot: SpecterProfile | null;
  similar_flags: SimilarFlag[];
  model_used: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  created_at: string;
}

export interface InvestigationEvent {
  type: "thinking" | "tool_call" | "task" | "assistant" | "status" | "artifact";
  payload: Record<string, unknown>;
  ts: string;
}

export interface Investigation {
  id: string;
  risk_event_id: string;
  cursor_agent_id: string | null;
  status: "running" | "finished" | "error" | "cancelled";
  events: InvestigationEvent[];
  artifacts: { path: string; mime: string; url?: string }[];
  duration_ms: number | null;
  created_at: string;
  finished_at: string | null;
}

export interface Metrics {
  total_cash_base: number;
  global_runway_months: number;
  largest_provider_exposure_pct: number;
  open_critical_count: number;
  briefs_last_hour: number;
  llm_spend_usd: number;
  daily_burn_calibrated_usd: number;
  observed_daily_outflow_usd: number;
}

export interface StateResponse {
  counterparties: Counterparty[];
  accounts: Account[];
  recent_transactions: Transaction[];
  open_risk_events: RiskEvent[];
  recent_briefs: Brief[];
  metrics: Metrics;
}

// WebSocket events
export type WSEvent =
  | { type: "counterparty_updated"; counterparty: Counterparty }
  | { type: "transaction_posted"; transaction: Transaction }
  | { type: "risk_event_created"; risk_event: RiskEvent }
  | { type: "brief_ready"; brief: Brief }
  | { type: "investigation_event"; investigation_id: string; event: InvestigationEvent }
  | { type: "metrics_updated"; metrics: Metrics };
