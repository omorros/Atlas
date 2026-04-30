"""FastAPI entrypoint. `uvicorn app.main:app --reload --port 8000`"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import simulator
from .routers import demo, internal, risk_events, state, ws
from .rules import ALL_RULES
from .rules.base import RuleEngine
from .seed import seed_if_empty

_rule_engine = RuleEngine(ALL_RULES, tick_seconds=5.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed_if_empty()
    _rule_engine.start()
    sim_task = asyncio.create_task(simulator.run(interval_seconds=4.0))
    try:
        yield
    finally:
        sim_task.cancel()
        try:
            await sim_task
        except asyncio.CancelledError:
            pass
        await _rule_engine.shutdown()


app = FastAPI(title="Counterparty Risk Radar", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(state.router)
app.include_router(demo.router)
app.include_router(internal.router)
app.include_router(risk_events.router)
app.include_router(ws.router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "radar-api"}
