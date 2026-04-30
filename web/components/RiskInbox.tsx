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
      if (!ev) return tab === "critical"; // if no event linkage, show in critical so we don't lose them
      if (tab === "critical") return ev.severity === "critical" || ev.status === "escalated";
      if (tab === "auto") return ev.status === "open" && ev.severity !== "critical";
      return ev.status === "resolved" || ev.status === "dismissed";
    });
  }, [briefs, eventsById, tab]);

  return (
    <aside className="absolute top-14 right-0 bottom-0 w-[380px] bg-panel/80 backdrop-blur border-l border-border z-10 flex flex-col">
      <div className="flex border-b border-border text-xs">
        <TabBtn cur={tab} t="critical" onClick={setTab} count={counts.critical} />
        <TabBtn cur={tab} t="auto" onClick={setTab} count={counts.auto} />
        <TabBtn cur={tab} t="resolved" onClick={setTab} count={counts.resolved} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-4 text-xs text-gray-500">
            Nothing here yet. Try the demo dock below.
          </div>
        )}
        {filtered.map((b) => {
          const ev = eventsById.get(b.risk_event_id);
          const conf = (b as any).llm_confidence ?? ev?.llm_confidence ?? 0;
          return (
            <button
              key={b.id}
              onClick={() => setOpen(b)}
              className="block w-full text-left p-3 border-b border-border hover:bg-bg/40 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm truncate">{b.headline}</span>
                <span className={`text-[10px] tracking-widest ${ev?.severity === "critical" ? "text-crit" : ev?.severity === "warn" ? "text-warn" : "text-gray-500"}`}>
                  {ev?.severity?.toUpperCase() ?? "INFO"}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1 truncate">{b.recommended_action}</div>
              <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-2">
                <span>{b.model_used}</span>
                <span>·</span>
                <span>{b.latency_ms}ms</span>
                {conf > 0 && (
                  <>
                    <span>·</span>
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
  const labels: Record<Tab, string> = { critical: "Critical", auto: "Auto-flagged", resolved: "Resolved" };
  return (
    <button
      onClick={() => onClick(t)}
      className={`flex-1 px-3 py-2 transition ${cur === t ? "text-accent border-b-2 border-accent" : "text-gray-400 hover:text-gray-200"}`}
    >
      {labels[t]} <span className="text-gray-500">({count})</span>
    </button>
  );
}
