"use client";

import { trigger } from "@/lib/api";

export default function DemoDock() {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-3 bg-panel/90 backdrop-blur border border-border rounded-full px-4 py-2">
      <Btn label="Bank downgrade" onClick={() => trigger("bank-downgrade")} />
      <Btn label="Queue vendor payment" onClick={() => trigger("queue-vendor-payment")} />
      <Btn label="Customer turn" onClick={() => trigger("customer-turn")} />
    </div>
  );
}

function Btn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 text-sm rounded-full bg-bg/60 border border-border hover:bg-accent/20 hover:border-accent/50 transition"
    >
      {label}
    </button>
  );
}
