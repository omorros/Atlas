import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Grain from "@/components/atlas/Grain";
import Particles from "@/components/atlas/Particles";
import BlurFade from "@/components/atlas/BlurFade";
import NumberTicker from "@/components/atlas/NumberTicker";
import AnimatedBeam from "@/components/atlas/AnimatedBeam";
import AtlasMark from "@/components/atlas/AtlasMark";
import Compass from "@/components/atlas/Compass";

export default function Landing() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-bg text-paper">
      <Grain />
      <Particles />

      {/* Atmospheric grid + vignette */}
      <div aria-hidden className="absolute inset-0 latlong z-0" />

      {/* Top chrome */}
      <header className="relative z-20 flex items-center justify-between px-8 pt-8 md:px-14 md:pt-10 font-mono text-[11px] tracking-widest uppercase text-paper-dim">
        <BlurFade delay={0.05} className="flex items-center gap-3">
          <Compass size={20} />
          <span className="text-paper">Atlas</span>
          <span className="text-muted">/ Counterparty Intelligence</span>
        </BlurFade>
        <BlurFade delay={0.15} className="hidden md:flex items-center gap-6">
          <span className="text-muted">L · 51.5074°N 0.1278°W</span>
          <span className="text-muted">v0.1.0</span>
          <span className="inline-flex items-center gap-2 text-ok">
            <span className="block h-1.5 w-1.5 rounded-full bg-ok animate-pulse-soft" />
            Sandbox
          </span>
        </BlurFade>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-8 md:px-14 pt-12 md:pt-20 pb-32">
        <div className="grid grid-cols-12 gap-8">
          {/* Left rail — section index */}
          <div className="hidden md:flex col-span-2 flex-col gap-6 pt-3 font-mono text-[10px] tracking-widest text-muted">
            <BlurFade delay={0.5}><div>I &nbsp; OVERVIEW</div></BlurFade>
            <BlurFade delay={0.6}><div className="text-paper">II &nbsp; ENTRY</div></BlurFade>
            <BlurFade delay={0.7}><div>III &nbsp; PIPELINE</div></BlurFade>
            <BlurFade delay={0.8}><div>IV &nbsp; CREDITS</div></BlurFade>
          </div>

          {/* Center — wordmark + tag + stats + CTA */}
          <div className="col-span-12 md:col-span-8 flex flex-col items-center text-center">
            <BlurFade delay={0.3} className="font-mono text-[10px] tracking-[0.4em] text-paper-dim mb-6">
              EST. 2026 — LONDON
            </BlurFade>

            <AtlasMark />

            <BlurFade delay={0.95} className="mt-6">
              <p className="font-display italic text-2xl md:text-3xl text-paper-dim leading-snug max-w-xl">
                A new cartography of counterparty risk.
              </p>
              <p className="mt-3 font-mono text-[11px] tracking-widest uppercase text-muted">
                Read · score · escalate · the agent never moves money
              </p>
            </BlurFade>

            {/* Stat band */}
            <BlurFade delay={1.15} className="mt-12 grid grid-cols-4 gap-12 md:gap-20 border-y border-border/60 py-6">
              <Stat n={5}  label="Banks" />
              <Stat n={6}  label="Vendors" />
              <Stat n={3}  label="Customers" />
              <Stat n={4}  label="Models" />
            </BlurFade>

            {/* CTA */}
            <BlurFade delay={1.45} className="mt-12 flex items-center gap-5">
              <Link
                href="/app"
                className="group relative inline-flex items-center gap-3 rounded-full border border-accent/50 bg-accent/5 px-8 py-3 font-mono text-[11px] tracking-[0.3em] uppercase text-paper transition-all hover:bg-accent/15 hover:border-accent hover:shadow-[0_0_40px_-10px_rgba(201,168,110,0.6)]"
              >
                Open Atlas
                <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                href="https://github.com/omorros/Cursor-hack"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[11px] tracking-widest uppercase text-paper-dim hover:text-paper transition"
              >
                Read the manifest →
              </Link>
            </BlurFade>
          </div>

          {/* Right rail — dateline */}
          <div className="hidden md:flex col-span-2 flex-col items-end gap-1 pt-3 font-mono text-[10px] tracking-widest text-muted">
            <BlurFade delay={0.5}><div>2026 · 04 · 30</div></BlurFade>
            <BlurFade delay={0.6}><div>HACKATHON ED.</div></BlurFade>
            <BlurFade delay={0.7}><div>TRACK 02</div></BlurFade>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="relative z-10 mx-auto max-w-6xl px-8 md:px-14 pb-20">
        <BlurFade delay={1.7} className="font-mono text-[10px] tracking-[0.3em] text-paper-dim text-center mb-6">
          IV — A FOUR-LAYER INTELLIGENCE PIPELINE
        </BlurFade>
        <BlurFade delay={1.85}>
          <div className="flex flex-col md:flex-row items-stretch gap-3 md:gap-0">
            <PipeBox roman="I"   label="Triage"        sub="Anthropic Haiku 4.5" />
            <AnimatedBeam delay={0} />
            <PipeBox roman="II"  label="Similarity"    sub="OpenAI 3-large" />
            <AnimatedBeam delay={0.2} />
            <PipeBox roman="III" label="Analyst"       sub="Anthropic Sonnet 4.6" />
            <AnimatedBeam delay={0.4} />
            <PipeBox roman="IV"  label="Investigation" sub="Cursor SDK · Cloud Agent" />
          </div>
        </BlurFade>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 px-8 md:px-14 py-6 font-mono text-[10px] tracking-widest text-muted flex flex-col md:flex-row justify-between gap-3">
        <span>POWERED BY ANTHROPIC · OPENAI · SPECTER · CURSOR · MAPBOX</span>
        <span>ATLAS LABS — BUILT IN LONDON · CURSOR × BRIEFCASE 2026</span>
      </footer>
    </main>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-display italic text-3xl md:text-4xl text-accent leading-none">
        <NumberTicker value={n} delay={1.3} />
      </span>
      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-paper-dim">
        {label}
      </span>
    </div>
  );
}

function PipeBox({ roman, label, sub }: { roman: string; label: string; sub: string }) {
  return (
    <div className="relative min-w-0 flex-1 rounded-sm border border-border/70 bg-panel/40 px-5 py-4 backdrop-blur-sm">
      <div className="flex items-baseline justify-between font-mono text-[9px] tracking-[0.25em] text-paper-dim uppercase mb-2">
        <span>{roman}</span>
        <span className="text-muted">stage</span>
      </div>
      <div className="font-display italic text-xl text-paper leading-tight">{label}</div>
      <div className="mt-1 font-mono text-[10px] tracking-widest text-muted uppercase">
        {sub}
      </div>
    </div>
  );
}
