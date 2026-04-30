import type { Metrics } from "@/lib/types";

export default function TopBar({ metrics }: { metrics: Metrics | null }) {
  return (
    <header className="absolute top-0 inset-x-0 z-10 flex items-center gap-6 px-6 py-3 bg-panel/80 backdrop-blur border-b border-border text-sm">
      <span className="font-semibold text-accent">RADAR</span>
      <Stat label="Runway" value={metrics ? `${metrics.global_runway_months.toFixed(1)} mo` : "—"} />
      <Stat label="Largest exposure" value={metrics ? `${(metrics.largest_provider_exposure_pct * 100).toFixed(0)}%` : "—"} />
      <Stat label="Critical open" value={metrics ? String(metrics.open_critical_count) : "—"} />
      <Stat label="Briefs / hr" value={metrics ? String(metrics.briefs_last_hour) : "—"} />
      <Stat label="Burn/d (cal)" value={metrics ? `$${metrics.daily_burn_calibrated_usd.toLocaleString()}` : "—"} />
      <Stat label="LLM spend" value={metrics ? `$${metrics.llm_spend_usd.toFixed(2)}` : "—"} />
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono text-gray-100">{value}</span>
    </div>
  );
}
