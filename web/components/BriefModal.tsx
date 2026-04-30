"use client";

import ReactMarkdown from "react-markdown";
import type { Brief } from "@/lib/types";
import { dismiss, escalate, investigate } from "@/lib/api";

export default function BriefModal({ brief, onClose }: { brief: Brief; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[640px] max-h-[80vh] overflow-y-auto bg-panel border border-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">{brief.headline}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100">×</button>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          model: <span className="text-accent">{brief.model_used}</span>
          {" · "}tokens {brief.tokens_in}/{brief.tokens_out}
          {" · "}{brief.latency_ms}ms
        </div>

        <article className="prose prose-invert prose-sm mt-4 text-sm text-gray-200 max-w-none [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:my-2 [&_ul]:my-2 [&_li]:my-0 [&_strong]:text-gray-100 [&_code]:text-accent [&_code]:bg-bg/40 [&_code]:px-1 [&_code]:rounded">
          <ReactMarkdown>{brief.body_md}</ReactMarkdown>
        </article>

        {brief.recommended_action && (
          <div className="mt-4 p-3 rounded border border-accent/30 bg-accent/5">
            <div className="text-[10px] tracking-widest text-accent uppercase mb-1">Recommended action</div>
            <div className="text-sm text-gray-100">{brief.recommended_action}</div>
          </div>
        )}

        {brief.specter_snapshot && (
          <details className="mt-4">
            <summary className="text-xs text-accent cursor-pointer">Specter snapshot</summary>
            <pre className="text-xs text-gray-400 mt-2 overflow-x-auto bg-bg/40 p-2 rounded">{JSON.stringify(brief.specter_snapshot, null, 2)}</pre>
          </details>
        )}

        {brief.similar_flags?.length > 0 && (
          <div className="mt-4">
            <div className="text-xs text-gray-400 mb-1">Similar prior flags</div>
            {brief.similar_flags.map((f) => (
              <div key={f.counterparty_id} className="text-xs">
                {f.name} <span className="text-accent">— cosine {f.cosine_sim.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={() => { dismiss(brief.risk_event_id); onClose(); }} className="px-4 py-2 text-sm rounded border border-border hover:bg-bg/40">Dismiss</button>
          <button onClick={() => investigate(brief.risk_event_id)} className="px-4 py-2 text-sm rounded bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30">Investigate further</button>
          <button onClick={() => { escalate(brief.risk_event_id); onClose(); }} className="px-4 py-2 text-sm rounded bg-crit/20 border border-crit/40 text-crit hover:bg-crit/30">Escalate</button>
        </div>
      </div>
    </div>
  );
}
