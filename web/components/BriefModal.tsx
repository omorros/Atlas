"use client";

import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import type { Brief } from "@/lib/types";
import { dismiss, escalate, investigate } from "@/lib/api";

export default function BriefModal({ brief, onClose }: { brief: Brief; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 12, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-[680px] max-h-[80vh] overflow-y-auto bg-panel border border-border rounded-sm"
      >
        {/* Brass corner ticks */}
        <span aria-hidden className="absolute top-2 left-2 w-2 h-2 border-l border-t border-accent/70" />
        <span aria-hidden className="absolute top-2 right-2 w-2 h-2 border-r border-t border-accent/70" />
        <span aria-hidden className="absolute bottom-2 left-2 w-2 h-2 border-l border-b border-accent/70" />
        <span aria-hidden className="absolute bottom-2 right-2 w-2 h-2 border-r border-b border-accent/70" />

        <div className="px-7 pt-7 pb-4 border-b border-border/60">
          <div className="font-mono text-[10px] tracking-[0.3em] text-paper-dim uppercase mb-2">Analyst brief</div>
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-display italic text-3xl text-paper leading-tight">{brief.headline}</h2>
            <button onClick={onClose} className="text-muted hover:text-paper text-2xl leading-none transition">×</button>
          </div>
          <div className="mt-3 font-mono text-[10px] tracking-widest text-muted uppercase">
            <span className="text-accent">{brief.model_used}</span>
            <span className="opacity-50 mx-2">·</span>
            <span>tokens {brief.tokens_in}/{brief.tokens_out}</span>
            <span className="opacity-50 mx-2">·</span>
            <span>{brief.latency_ms}ms</span>
          </div>
        </div>

        <div className="px-7 py-6">
          <article className="prose prose-invert prose-sm max-w-none text-paper [&_h1]:font-display [&_h1]:italic [&_h1]:text-xl [&_h2]:font-display [&_h2]:italic [&_h2]:text-base [&_p]:my-2 [&_p]:text-paper-dim [&_p]:leading-relaxed [&_strong]:text-paper [&_code]:text-accent [&_code]:bg-ink [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_ul]:my-2 [&_li]:my-0.5 [&_li]:text-paper-dim">
            <ReactMarkdown>{brief.body_md}</ReactMarkdown>
          </article>

          {brief.recommended_action && (
            <div className="mt-5 p-4 rounded-sm border border-accent/40 bg-accent/5">
              <div className="font-mono text-[9px] tracking-[0.3em] text-accent uppercase mb-1">Recommended action</div>
              <div className="font-display italic text-lg text-paper">{brief.recommended_action}</div>
            </div>
          )}

          {brief.specter_snapshot && (
            <details className="mt-5 group">
              <summary className="cursor-pointer font-mono text-[10px] tracking-widest text-paper-dim uppercase hover:text-accent transition list-none flex items-center gap-2">
                <span className="group-open:rotate-90 transition inline-block">›</span>
                Specter snapshot
              </summary>
              <pre className="mt-2 text-[11px] text-paper-dim overflow-x-auto bg-ink p-3 rounded-sm font-mono">
                {JSON.stringify(brief.specter_snapshot, null, 2)}
              </pre>
            </details>
          )}

          {brief.similar_flags?.length > 0 && (
            <div className="mt-5">
              <div className="font-mono text-[9px] tracking-[0.3em] text-paper-dim uppercase mb-2">Similar prior flags</div>
              <div className="space-y-1">
                {brief.similar_flags.map((f) => (
                  <div key={f.counterparty_id} className="font-mono text-xs text-paper">
                    {f.name}{" "}
                    <span className="text-accent">— cosine {f.cosine_sim.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-7 py-4 border-t border-border/60 flex gap-2 justify-end font-mono text-[10px] tracking-widest uppercase">
          <ActionBtn variant="ghost" onClick={() => { dismiss(brief.risk_event_id); onClose(); }}>Dismiss</ActionBtn>
          <ActionBtn variant="brass" onClick={() => investigate(brief.risk_event_id)}>Investigate further</ActionBtn>
          <ActionBtn variant="crit" onClick={() => { escalate(brief.risk_event_id); onClose(); }}>Escalate</ActionBtn>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ActionBtn({ children, onClick, variant }: { children: React.ReactNode; onClick: () => void; variant: "ghost" | "brass" | "crit" }) {
  const cls = {
    ghost: "border-border text-paper-dim hover:text-paper hover:bg-ink/60",
    brass: "border-accent/50 text-accent bg-accent/5 hover:bg-accent/15 hover:border-accent",
    crit:  "border-crit/50 text-crit bg-crit/5 hover:bg-crit/15 hover:border-crit",
  }[variant];
  return (
    <button onClick={onClick} className={`px-4 py-2 border rounded-sm transition ${cls}`}>
      {children}
    </button>
  );
}
