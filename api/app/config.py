"""Centralised config & env loading. Import `settings` everywhere else."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from api/, then fall back to repo root .env
load_dotenv(Path(__file__).parent.parent / ".env")
load_dotenv(Path(__file__).parent.parent.parent / ".env")


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./data/radar.db")
    ANTHROPIC_API_KEY: str | None = os.getenv("ANTHROPIC_API_KEY") or None
    ANTHROPIC_TRIAGE_MODEL: str = os.getenv("ANTHROPIC_TRIAGE_MODEL", "claude-3-5-haiku-20241022")
    ANTHROPIC_ANALYST_MODEL: str = os.getenv("ANTHROPIC_ANALYST_MODEL", "claude-sonnet-4-20250514")
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY") or None
    SPECTER_API_KEY: str | None = os.getenv("SPECTER_API_KEY") or None
    SPECTER_BASE_URL: str = os.getenv("SPECTER_BASE_URL", "https://app.tryspecter.com/api/v1")
    SIDECAR_URL: str = os.getenv("SIDECAR_URL", "http://localhost:8001")

    REPO_ROOT: Path = Path(__file__).parent.parent.parent
    SHARED_DIR: Path = REPO_ROOT / "shared"
    FIXTURES_PATH: Path = SHARED_DIR / "fixtures.json"
    DATA_DIR: Path = Path(__file__).parent.parent / "data"

    # Spine: optional `X-Internal-Token` for `/internal/*`
    INTERNAL_TOKEN: str | None = os.getenv("INTERNAL_TOKEN") or None
    # If false, `POST /demo/reset` returns 403.
    DEMO_RESET_ENABLED: bool = os.getenv("DEMO_RESET_ENABLED", "1") not in ("0", "false", "False")

    # Runway: blend observed outbound burn (rolling window) with policy/min floors
    METRICS_POLICY_DAILY_BURN_USD: float = float(os.getenv("METRICS_POLICY_DAILY_BURN_USD", "35000"))
    METRICS_MIN_DAILY_BURN_USD: float = float(os.getenv("METRICS_MIN_DAILY_BURN_USD", "2000"))
    METRICS_BURN_LOOKBACK_DAYS: int = int(os.getenv("METRICS_BURN_LOOKBACK_DAYS", "30"))

    # Feature flags / safety
    HAS_ANTHROPIC: bool = property(lambda s: bool(s.ANTHROPIC_API_KEY))  # type: ignore
    HAS_OPENAI: bool = property(lambda s: bool(s.OPENAI_API_KEY))  # type: ignore
    HAS_SPECTER: bool = property(lambda s: bool(s.SPECTER_API_KEY))  # type: ignore


settings = Settings()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
