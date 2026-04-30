"""Shared Pydantic schemas. Mirror of shared/types.ts.

If you change this file, update types.ts to keep backend + frontend in sync.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Region = Literal["UK", "EU", "US", "APAC"]
CounterpartyType = Literal["bank", "vendor", "customer"]
HealthTag = Literal["stable", "watch", "fragile"]
Direction = Literal["in", "out"]
TxStatus = Literal["scheduled", "posted", "queued_for_approval"]
RiskEventStatus = Literal["open", "escalated", "dismissed", "resolved"]
Severity = Literal["info", "warn", "critical"]
RuleId = Literal["R1", "R2", "R3", "R4", "R5"]


class SpecterProfile(BaseModel):
    company: str
    headcount: int
    headcount_delta_90d_pct: float
    last_funding_round_date: str | None = None
    last_funding_round_amount_musd: float | None = None
    investors: list[str] = Field(default_factory=list)
    news_flags: list[str] = Field(default_factory=list)
    incorporated: str
    website: str | None = None
    address: str


class Counterparty(BaseModel):
    id: str
    name: str
    type: CounterpartyType
    provider: str
    region: Region
    lat: float
    lng: float
    specter_id: str | None = None
    health_tag: HealthTag = "stable"
    max_exposure_pct: float = 1.0
    profile_json: SpecterProfile | None = None


class Account(BaseModel):
    id: str
    counterparty_id: str
    name: str
    currency: str
    balance: float
    region: Region


class Transaction(BaseModel):
    id: str
    direction: Direction
    counterparty_id: str
    account_id: str
    amount: float
    currency: str
    status: TxStatus
    description: str
    occurred_at: datetime


class RiskEvent(BaseModel):
    id: str
    counterparty_id: str
    trigger_rule: RuleId
    trigger_payload: dict[str, Any] = Field(default_factory=dict)
    raw_score: float = 0.0
    llm_confidence: float = 0.0
    severity: Severity = "info"
    status: RiskEventStatus = "open"
    created_at: datetime


class SimilarFlag(BaseModel):
    counterparty_id: str
    name: str
    cosine_sim: float
    flagged_at: str


class Brief(BaseModel):
    id: str
    risk_event_id: str
    headline: str
    body_md: str
    recommended_action: str
    specter_snapshot: SpecterProfile | None = None
    similar_flags: list[SimilarFlag] = Field(default_factory=list)
    model_used: str
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: int = 0
    created_at: datetime


class InvestigationEvent(BaseModel):
    type: Literal["thinking", "tool_call", "task", "assistant", "status", "artifact"]
    payload: dict[str, Any]
    ts: datetime


class Investigation(BaseModel):
    id: str
    risk_event_id: str
    cursor_agent_id: str | None = None
    status: Literal["running", "finished", "error", "cancelled"] = "running"
    events: list[InvestigationEvent] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    duration_ms: int | None = None
    created_at: datetime
    finished_at: datetime | None = None


class Metrics(BaseModel):
    total_cash_base: float
    global_runway_months: float
    largest_provider_exposure_pct: float
    open_critical_count: int
    briefs_last_hour: int
    llm_spend_usd: float
    daily_burn_calibrated_usd: float = 0.0
    observed_daily_outflow_usd: float = 0.0


class StateResponse(BaseModel):
    counterparties: list[Counterparty]
    accounts: list[Account]
    recent_transactions: list[Transaction]
    open_risk_events: list[RiskEvent]
    recent_briefs: list[Brief]
    metrics: Metrics
