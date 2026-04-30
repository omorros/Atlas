"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Globe from "@/components/Globe";
import RiskInbox from "@/components/RiskInbox";
import DemoDock from "@/components/DemoDock";
import TopBar from "@/components/TopBar";
import { fetchState } from "@/lib/api";
import { useWS } from "@/lib/ws";
import type { Counterparty, Brief, RiskEvent, Metrics } from "@/lib/types";

export default function Dashboard() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    fetchState()
      .then((s) => {
        setCounterparties(s.counterparties);
        setBriefs(s.recent_briefs);
        setEvents(s.open_risk_events);
        setMetrics(s.metrics);
      })
      .catch((e) => console.warn("fetch /state failed - running in offline mode", e));
  }, []);

  useWS({
    counterparty_updated: (cp: Counterparty) =>
      setCounterparties((prev) => prev.map((p) => (p.id === cp.id ? { ...p, ...cp } : p))),
    risk_event_created: (e: RiskEvent) => setEvents((prev) => [e, ...prev]),
    brief_ready: (b: Brief) => setBriefs((prev) => [b, ...prev]),
    metrics_updated: (m: Metrics) => setMetrics(m),
  });

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-bg text-gray-100">
      <Globe counterparties={counterparties} />
      <TopBar metrics={metrics} />
      <RiskInbox events={events} briefs={briefs} />
      <DemoDock />
      <Link
        href="/"
        className="absolute top-3 right-6 z-20 text-xs tracking-widest text-gray-400 hover:text-accent"
      >
        HOME
      </Link>
      <div className="absolute bottom-2 left-2 text-xs text-gray-500">
        SANDBOX — no real money moves.
      </div>
    </main>
  );
}
