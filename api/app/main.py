"""FastAPI entrypoint. `uvicorn app.main:app --reload --port 8000`"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import demo, risk_events, state, ws
from .rules import ALL_RULES
from .rules.base import RuleEngine
from .seed import seed_if_empty

_rule_engine = RuleEngine(ALL_RULES, tick_seconds=5.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_if_empty()
    _rule_engine.start()
    # TODO(A): start the transaction simulator background task here.
    yield


app = FastAPI(title="Counterparty Risk Radar", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(state.router)
app.include_router(demo.router)
app.include_router(risk_events.router)
app.include_router(ws.router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "radar-api"}
