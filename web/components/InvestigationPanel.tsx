"use client";

// Owner: D - wire this up when sidecar streams investigation_event over WS.

import type { InvestigationEvent } from "@/lib/types";

export default function InvestigationPanel({
  events,
  onClose,
}: {
  events: InvestigationEvent[];
  onClose: () => void;
}) {
  return (
    <aside className="absolute top-14 right-[380px] bottom-0 w-[420px] bg-panel/95 backdrop-blur border-l border-border z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm font-semibold">Deep Investigation (Cursor Cloud Agent)</span>
        <button onClick={onClose} className="text-gray-400">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs font-mono">
        {events.length === 0 && <div className="text-gray-500">Waiting for agent events…</div>}
        {events.map((e, i) => (
          <div key={i} className="mb-2">
            <span className="text-accent">[{e.type}]</span>{" "}
            <span className="text-gray-300">{JSON.stringify(e.payload)}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
