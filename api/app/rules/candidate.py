"""Shared candidate type for rules + pipeline. Owner: B."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class RiskEventCandidate:
    counterparty_id: str
    trigger_rule: str
    trigger_payload: dict[str, Any] = field(default_factory=dict)
    raw_score: float = 0.0
