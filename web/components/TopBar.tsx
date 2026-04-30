import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Compass from "./atlas/Compass";
import type { Metrics } from "@/lib/types";

export default function TopBar({ metrics }: { metrics: Metrics | null }) {
  return (
    <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-between gap-6 px-6 py-3 bg-panel/85 backdrop-blur border-b border-border font-mono text-[10px] tracking-widest uppercase">
      <div className="flex items-center gap-4 text-paper">
        <Link
          href="/"
          aria-label="Back to landing"
          className="flex items-center gap-2 text-paper-dim hover:text-accent transition"
        >
          <ArrowLeft size={14} />
        </Link>
        <span className="block w-px h-4 bg-border/70" />
        <Link href="/" className="flex items-center gap-3 hover:text-accent transition">
          <Compass size={18} />
          <span className="font-display italic text-base text-paper">Atlas</span>
          <span className="text-muted">/ Live</span>
        </Link>
      </div>
      <div className="flex items-center gap-6 text-paper-dim">
        <Stat label="Runway" value={metrics ? `${metrics.global_runway_months.toFixed(1)} mo` : "—"} />
        <Stat label="Largest exposure" value={metrics ? `${(metrics.largest_provider_exposure_pct * 100).toFixed(0)}%` : "—"} />
        <Stat label="Critical" value={metrics ? String(metrics.open_critical_count) : "—"} tone={metrics && metrics.open_critical_count > 0 ? "crit" : undefined} />
        <Stat label="Burn / d" value={metrics ? `$${metrics.daily_burn_calibrated_usd.toLocaleString()}` : "—"} />
        <Stat label="Briefs / hr" value={metrics ? String(metrics.briefs_last_hour) : "—"} />
        <Stat label="LLM spend" value={metrics ? `$${metrics.llm_spend_usd.toFixed(2)}` : "—"} />
      </div>
    </header>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "crit" }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums ${tone === "crit" ? "text-crit" : "text-paper"}`}>
        {value}
      </span>
    </div>
  );
}
