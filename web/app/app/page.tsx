"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Globe from "@/components/Globe";
import RiskInbox from "@/components/RiskInbox";
import DemoDock from "@/components/DemoDock";
import TopBar from "@/components/TopBar";
import InvestigationPanel from "@/components/InvestigationPanel";
import { fetchState } from "@/lib/api";
import { useWS } from "@/lib/ws";
import type {
  Brief, Counterparty, InvestigationEvent, Metrics, RiskEvent, Transaction,
} from "@/lib/types";

export default function Dashboard() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [pulses, setPulses] = useState<{ counterparty_id: string; severity: string; ts: number }[]>([]);
  const [flows, setFlows] = useState<{ from: [number, number]; to: [number, number]; direction: "in" | "out"; ts: number }[]>([]);
  const [investigationEvents, setInvestigationEvents] = useState<InvestigationEvent[]>([]);
  const [investigationOpen, setInvestigationOpen] = useState(false);
  const [accountsById, setAccountsById] = useState<Record<string, { region: string }>>({});

  useEffect(() => {
    fetchState()
      .then((s) => {
        setCounterparties(s.counterparties);
        setBriefs(s.recent_briefs);
        setEvents(s.open_risk_events);
        setMetrics(s.metrics);
        const idx: Record<string, { region: string }> = {};
        s.accounts.forEach((a: any) => (idx[a.id] = { region: a.region }));
        setAccountsById(idx);
      })
      .catch((e) => console.warn("fetch /state failed - running in offline mode", e));
  }, []);

  useWS({
    counterparty_updated: (cp: Counterparty) => {
      setCounterparties((prev) => prev.map((p) => (p.id === cp.id ? { ...p, ...cp } : p)));
      setPulses((prev) => [...prev.filter((p) => Date.now() - p.ts < 2500), {
        counterparty_id: cp.id, severity: cp.health_tag, ts: Date.now(),
      }]);
    },
    risk_event_created: (e: RiskEvent) => {
      setEvents((prev) => [e, ...prev]);
      setPulses((prev) => [...prev.filter((p) => Date.now() - p.ts < 2500), {
        counterparty_id: e.counterparty_id, severity: e.severity, ts: Date.now(),
      }]);
    },
    brief_ready: (b: Brief) => setBriefs((prev) => [b, ...prev]),
    metrics_updated: (m: Metrics) => setMetrics(m),
    transaction_posted: (t: Transaction) => {
      const cp = counterparties.find((c) => c.id === t.counterparty_id);
      const acc = accountsById[t.account_id];
      if (!cp || !acc) return;
      const accCp = counterparties.find((c) => c.type === "bank" && c.region === acc.region);
      if (!accCp) return;
      setFlows((prev) => [...prev.filter((f) => Date.now() - f.ts < 3000), {
        from: t.direction === "out" ? [accCp.lng, accCp.lat] : [cp.lng, cp.lat],
        to:   t.direction === "out" ? [cp.lng, cp.lat]       : [accCp.lng, accCp.lat],
        direction: t.direction, ts: Date.now(),
      }]);
    },
    investigation_event: (payload: any) => {
      setInvestigationOpen(true);
      setInvestigationEvents((prev) => [...prev, payload?.event ?? payload]);
    },
  });

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-bg text-gray-100">
      <Globe counterparties={counterparties} pulseEvents={pulses} flowEvents={flows} />
      <TopBar metrics={metrics} />
      <RiskInbox events={events} briefs={briefs} />
      {investigationOpen && (
        <InvestigationPanel
          events={investigationEvents}
          onClose={() => { setInvestigationOpen(false); setInvestigationEvents([]); }}
        />
      )}
      <DemoDock />
      <Link
        href="/"
        className="absolute top-3 right-6 z-30 text-xs tracking-widest text-gray-400 hover:text-accent"
      >
        HOME
      </Link>
      <div className="absolute bottom-2 left-2 text-xs text-gray-500 z-30">
        SANDBOX — no real money moves.
      </div>
    </main>
  );
}
