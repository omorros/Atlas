"use client";

import { useState } from "react";
import type { Brief, RiskEvent } from "@/lib/types";
import BriefModal from "./BriefModal";

type Tab = "critical" | "auto" | "resolved";

export default function RiskInbox({ events, briefs }: { events: RiskEvent[]; briefs: Brief[] }) {
  const [tab, setTab] = useState<Tab>("critical");
  const [open, setOpen] = useState<Brief | null>(null);

  // TODO(C): join events to briefs by risk_event_id and filter by tab properly.
  const filtered = briefs;

  return (
    <aside className="absolute top-14 right-0 bottom-0 w-[380px] bg-panel/80 backdrop-blur border-l border-border z-10 flex flex-col">
      <div className="flex border-b border-border text-xs">
        <Tab cur={tab} t="critical" onClick={setTab} count={events.filter(e => e.severity === "critical" || e.status === "escalated").length} />
        <Tab cur={tab} t="auto" onClick={setTab} count={events.filter(e => e.status === "open").length} />
        <Tab cur={tab} t="resolved" onClick={setTab} count={events.filter(e => e.status === "resolved").length} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && <div className="p-4 text-xs text-gray-500">Nothing here yet. Try the demo dock below.</div>}
        {filtered.map((b) => (
          <button key={b.id} onClick={() => setOpen(b)} className="block w-full text-left p-3 border-b border-border hover:bg-bg/40">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{b.headline}</span>
              <span className="text-xs text-gray-400">{(b as any).model_used || "—"}</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">{b.recommended_action}</div>
          </button>
        ))}
      </div>
      {open && <BriefModal brief={open} onClose={() => setOpen(null)} />}
    </aside>
  );
}

function Tab({ cur, t, onClick, count }: { cur: Tab; t: Tab; onClick: (t: Tab) => void; count: number }) {
  const labels: Record<Tab, string> = { critical: "Critical", auto: "Auto-flagged", resolved: "Resolved" };
  return (
    <button
      onClick={() => onClick(t)}
      className={`flex-1 px-3 py-2 ${cur === t ? "text-accent border-b-2 border-accent" : "text-gray-400"}`}
    >
      {labels[t]} <span className="text-gray-500">({count})</span>
    </button>
  );
}
