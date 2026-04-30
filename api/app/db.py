"""SQLAlchemy async engine + session + simple model bag.

Tables are intentionally lean - JSON columns hold most of the schema-shaped data so
we can iterate fast during the hack. Migrate to typed columns post-hack if needed.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy import JSON, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class CounterpartyRow(Base):
    __tablename__ = "counterparties"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)         # bank | vendor | customer
    provider = Column(String, nullable=False)
    region = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    specter_id = Column(String, nullable=True)
    profile_json = Column(JSON, nullable=True)
    embedding = Column(JSON, nullable=True)        # list[float]; in-memory cosine
    health_tag = Column(String, default="stable")
    max_exposure_pct = Column(Float, default=1.0)


class AccountRow(Base):
    __tablename__ = "accounts"
    id = Column(String, primary_key=True)
    counterparty_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    currency = Column(String, nullable=False)
    balance = Column(Float, nullable=False)
    region = Column(String, nullable=False)


class TransactionRow(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True)
    direction = Column(String, nullable=False)
    counterparty_id = Column(String, nullable=False)
    account_id = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False)
    status = Column(String, nullable=False)
    description = Column(String, default="")
    occurred_at = Column(DateTime, nullable=False)


class RiskEventRow(Base):
    __tablename__ = "risk_events"
    id = Column(String, primary_key=True)
    counterparty_id = Column(String, nullable=False)
    trigger_rule = Column(String, nullable=False)
    trigger_payload = Column(JSON, default=dict)
    raw_score = Column(Float, default=0.0)
    llm_confidence = Column(Float, default=0.0)
    severity = Column(String, default="info")
    status = Column(String, default="open")
    created_at = Column(DateTime, nullable=False)


class BriefRow(Base):
    __tablename__ = "briefs"
    id = Column(String, primary_key=True)
    risk_event_id = Column(String, nullable=False)
    headline = Column(String, nullable=False)
    body_md = Column(Text, nullable=False)
    recommended_action = Column(String, default="")
    specter_snapshot = Column(JSON, nullable=True)
    similar_flags = Column(JSON, default=list)
    model_used = Column(String, nullable=False)
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    latency_ms = Column(Integer, default=0)
    created_at = Column(DateTime, nullable=False)


class InvestigationRow(Base):
    __tablename__ = "investigations"
    id = Column(String, primary_key=True)
    risk_event_id = Column(String, nullable=False)
    cursor_agent_id = Column(String, nullable=True)
    status = Column(String, default="running")
    events = Column(JSON, default=list)
    artifacts = Column(JSON, default=list)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False)
    finished_at = Column(DateTime, nullable=True)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
