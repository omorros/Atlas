import Link from "next/link";

export default function Landing() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-bg text-gray-100 font-mono">
      {/* Top-left wordmark */}
      <div className="absolute top-6 left-8 text-sm tracking-[0.2em] font-semibold">
        RADAR<span className="text-accent">_</span>
      </div>

      {/* Soft radial backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 38%, rgba(125, 211, 252, 0.10) 0%, rgba(10, 13, 18, 0) 70%)",
        }}
      />

      {/* Center hero */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pb-32 pt-20">
        <h1
          className="text-center text-[14vw] md:text-[10vw] font-extrabold leading-none tracking-tight"
          style={{ textShadow: "0 0 60px rgba(125, 211, 252, 0.45)" }}
        >
          RADAR
        </h1>

        <p className="mt-3 text-center text-[10px] md:text-xs tracking-[0.3em] text-gray-400 uppercase">
          Counterparty risk intelligence for treasury · Track 02
        </p>

        {/* Stat counters */}
        <div className="mt-10 grid grid-cols-4 gap-10 md:gap-16">
          <Stat n="5" label="Banks" />
          <Stat n="6" label="Vendors" />
          <Stat n="3" label="Customers" />
          <Stat n="4" label="Models" />
        </div>

        {/* CTA */}
        <Link
          href="/app"
          className="mt-12 rounded-full border border-accent/60 bg-bg/40 px-8 py-3 text-xs md:text-sm tracking-[0.25em] text-gray-100 transition hover:bg-accent/15 hover:shadow-[0_0_30px_rgba(125,211,252,0.35)]"
        >
          ENTER WAR ROOM
        </Link>

        <p className="mt-6 text-center text-[11px] tracking-widest text-gray-500 max-w-xl">
          Read, score, escalate. The agent never moves money.
        </p>
      </section>

      {/* Pipeline diagram */}
      <section className="absolute bottom-10 left-0 right-0 z-10 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center text-[10px] tracking-[0.3em] text-gray-500">
            4-LAYER INTELLIGENCE PIPELINE
          </div>
          <div className="mt-4 flex flex-wrap items-stretch justify-center gap-3">
            <Pipe label="Triage" sub="Haiku 4.5" />
            <Pipe label="Similarity" sub="OpenAI · 3-large" />
            <Pipe label="Analyst" sub="Sonnet 4.6" />
            <Pipe label="Investigation" sub="Cursor SDK" />
          </div>
          <div className="mt-6 text-center text-[10px] tracking-[0.3em] text-gray-500">
            POWERED BY ANTHROPIC · OPENAI · SPECTER · CURSOR SDK
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl md:text-3xl font-bold text-accent">{n}</span>
      <span className="mt-1 text-[10px] tracking-[0.25em] text-gray-400 uppercase">
        {label}
      </span>
    </div>
  );
}

function Pipe({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="min-w-[120px] flex-1 max-w-[160px] rounded-md border border-accent/30 bg-panel/40 px-4 py-3 text-center backdrop-blur">
      <div className="text-sm font-semibold text-gray-100">{label}</div>
      <div className="mt-1 text-[10px] tracking-widest text-gray-400 uppercase">
        {sub}
      </div>
    </div>
  );
}
