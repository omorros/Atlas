"use client";

import { useMemo, useState } from "react";
import type { Brief, RiskEvent } from "@/lib/types";
import BriefModal from "./BriefModal";

type Tab = "critical" | "auto" | "resolved";

export default function RiskInbox({ events, briefs }: { events: RiskEvent[]; briefs: Brief[] }) {
  const [tab, setTab] = useState<Tab>("critical");
  const [open, setOpen] = useState<Brief | null>(null);

  const eventsById = useMemo(() => {
    const m = new Map<string, RiskEvent>();
    events.forEach((e) => m.set(e.id, e));
    return m;
  }, [events]);

  const counts = useMemo(() => ({
    critical: events.filter((e) => e.severity === "critical" || e.status === "escalated").length,
    auto: events.filter((e) => e.status === "open" && e.severity !== "critical").length,
    resolved: events.filter((e) => e.status === "resolved" || e.status === "dismissed").length,
  }), [events]);

  const filtered = useMemo(() => {
    return briefs.filter((b) => {
      const ev = eventsById.get(b.risk_event_id);
      if (!ev) return tab === "critical";
      if (tab === "critical") return ev.severity === "critical" || ev.status === "escalated";
      if (tab === "auto") return ev.status === "open" && ev.severity !== "critical";
      return ev.status === "resolved" || ev.status === "dismissed";
    });
  }, [briefs, eventsById, tab]);

  return (
    <aside className="absolute top-12 right-0 bottom-0 w-[400px] bg-panel/85 backdrop-blur border-l border-border z-10 flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="font-mono text-[10px] tracking-[0.3em] text-paper-dim uppercase">Risk inbox</div>
        <div className="mt-1 font-display italic text-2xl text-paper">Counterparty signals</div>
      </div>
      <div className="flex border-b border-border font-mono text-[10px] tracking-widest uppercase">
        <TabBtn cur={tab} t="critical" onClick={setTab} count={counts.critical} />
        <TabBtn cur={tab} t="auto" onClick={setTab} count={counts.auto} />
        <TabBtn cur={tab} t="resolved" onClick={setTab} count={counts.resolved} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-xs text-muted leading-relaxed">
            <div className="font-display italic text-paper-dim text-base mb-1">All clear.</div>
            Try a trigger from the demo dock to see Atlas at work.
          </div>
        )}
        {filtered.map((b) => {
          const ev = eventsById.get(b.risk_event_id);
          const conf = (b as any).llm_confidence ?? ev?.llm_confidence ?? 0;
          const sev = ev?.severity ?? "info";
          return (
            <button
              key={b.id}
              onClick={() => setOpen(b)}
              className="block w-full text-left p-4 border-b border-border/60 hover:bg-ink/40 transition group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display italic text-base text-paper truncate group-hover:text-accent transition">{b.headline}</span>
                <span className={`font-mono text-[9px] tracking-widest uppercase ${sev === "critical" ? "text-crit" : sev === "warn" ? "text-warn" : "text-muted"}`}>
                  {sev}
                </span>
              </div>
              <div className="mt-1 text-xs text-paper-dim line-clamp-2">{b.recommended_action}</div>
              <div className="mt-2 flex items-center gap-3 font-mono text-[10px] tracking-widest text-muted uppercase">
                <span>{b.model_used}</span>
                <span className="opacity-50">·</span>
                <span>{b.latency_ms}ms</span>
                {conf > 0 && (
                  <>
                    <span className="opacity-50">·</span>
                    <span className="text-accent">conf {Number(conf).toFixed(2)}</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {open && <BriefModal brief={open} onClose={() => setOpen(null)} />}
    </aside>
  );
}

function TabBtn({ cur, t, onClick, count }: { cur: Tab; t: Tab; onClick: (t: Tab) => void; count: number }) {
  const labels: Record<Tab, string> = { critical: "Critical", auto: "Auto", resolved: "Resolved" };
  return (
    <button
      onClick={() => onClick(t)}
      className={`flex-1 px-3 py-2.5 transition border-b-2 ${cur === t ? "text-accent border-accent" : "text-muted border-transparent hover:text-paper-dim"}`}
    >
      {labels[t]} <span className="opacity-60">({count})</span>
    </button>
  );
}
