"use client";

import type { InvestigationEvent } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const ICONS: Record<string, string> = {
  thinking: "·",
  tool_call: "→",
  task: "✓",
  assistant: "▸",
  status: "○",
  artifact: "▣",
};

const COLOURS: Record<string, string> = {
  thinking: "text-gray-400",
  tool_call: "text-accent",
  task: "text-ok",
  assistant: "text-gray-100",
  status: "text-gray-500",
  artifact: "text-warn",
};

export default function InvestigationPanel({
  events,
  onClose,
  title = "Deep Investigation",
}: {
  events: InvestigationEvent[];
  onClose: () => void;
  title?: string;
}) {
  return (
    <aside className="absolute top-14 right-[380px] bottom-0 w-[440px] bg-panel/95 backdrop-blur border-l border-border z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div>
          <span className="text-sm font-semibold">{title}</span>
          <span className="ml-2 text-[10px] tracking-widest text-accent">CURSOR CLOUD AGENT</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-100">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-xs font-mono space-y-2">
        {events.length === 0 && (
          <div className="text-gray-500 italic">Waiting for agent events…</div>
        )}
        {events.map((e, i) => {
          const p = e.payload as any;
          const icon = ICONS[e.type] ?? "·";
          const color = COLOURS[e.type] ?? "text-gray-300";
          return (
            <div key={i} className="leading-snug">
              <div className="flex items-baseline gap-2">
                <span className={`${color} font-bold w-3`}>{icon}</span>
                <span className="text-[10px] tracking-widest text-gray-500 uppercase">{e.type}</span>
              </div>
              <div className={`pl-5 ${color}`}>
                {p.text ?? p.milestone ?? p.name ?? p.path ?? JSON.stringify(p)}
              </div>
              {e.type === "tool_call" && p.args && (
                <div className="pl-5 text-gray-500 text-[10px] mt-0.5">
                  args: {JSON.stringify(p.args)}
                </div>
              )}
              {e.type === "artifact" && p.path && (
                <div className="pl-5 mt-1">
                  <a
                    href={typeof p.url === "string" ? `${API}${p.url}` : "#"}
                    target={typeof p.url === "string" ? "_blank" : undefined}
                    rel="noreferrer"
                    className="text-[10px] tracking-widest text-warn underline"
                  >
                    Download {p.path}
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
