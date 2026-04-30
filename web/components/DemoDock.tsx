"use client";

import { trigger } from "@/lib/api";

export default function DemoDock() {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-stretch overflow-hidden rounded-sm border border-border bg-panel/90 backdrop-blur shadow-[0_8px_30px_-10px_rgba(0,0,0,0.6)]">
      <Label>Demo</Label>
      <Btn label="Bank downgrade"        onClick={() => trigger("bank-downgrade")} />
      <Divider />
      <Btn label="Queue vendor payment"  onClick={() => trigger("queue-vendor-payment")} />
      <Divider />
      <Btn label="Customer turn"         onClick={() => trigger("customer-turn")} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2 bg-ink/60 font-mono text-[10px] tracking-[0.3em] uppercase text-paper-dim flex items-center">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="w-px bg-border/70 self-stretch" />;
}

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 font-mono text-[11px] tracking-widest uppercase text-paper hover:bg-accent/15 hover:text-accent transition"
    >
      {label}
    </button>
  );
}
