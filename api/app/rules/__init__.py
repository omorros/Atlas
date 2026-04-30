"""Rule plugins + registry (R1–R4)."""
from __future__ import annotations

from .r1_specter_delta import R1SpecterDelta
from .r2_standing_exposure import R2StandingExposure
from .r3_new_counterparty import R3NewCounterparty
from .r4_anomalous_payment import R4AnomalousPayment

ALL_RULES = [
    R1SpecterDelta(),
    R2StandingExposure(),
    R3NewCounterparty(),
    R4AnomalousPayment(),
]

__all__ = ["ALL_RULES", "R1SpecterDelta", "R2StandingExposure", "R3NewCounterparty", "R4AnomalousPayment"]
