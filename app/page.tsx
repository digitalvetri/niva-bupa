"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Zap, MessageSquareText, FileImage, ShieldCheck, TrendingUp, PhoneCall } from "lucide-react";
import { NivaBupaLogo } from "@/components/brand/niva-bupa-logo";

function useCountUp(target: number, duration = 1500) {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / duration);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function Stat({ target, suffix = "", prefix = "", label, decimals = 0 }: { target: number; suffix?: string; prefix?: string; label: string; decimals?: number }) {
  const v = useCountUp(target);
  return (
    <div className="text-center">
      <div className="text-3xl font-extrabold text-white sm:text-4xl">{prefix}{v.toFixed(decimals)}{suffix}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-cyan-200/70">{label}</div>
    </div>
  );
}

const FEATURES = [
  { icon: Zap, title: "Instant dashboards", desc: "Upload a New Business CSV → a fully-segmented command center in under 10 seconds." },
  { icon: MessageSquareText, title: "Ask in Tanglish", desc: "\"Salem-la evlo pending?\" — verified numbers, never a hallucinated figure." },
  { icon: PhoneCall, title: "Who to call today", desc: "AI ranks your highest-value stuck cases and drafts the WhatsApp nudge." },
  { icon: FileImage, title: "Branded reports", desc: "One-tap performance posters per branch and territory, ready to share." },
  { icon: TrendingUp, title: "Week-over-week", desc: "Compare any two uploads — see exactly what moved, and why." },
  { icon: ShieldCheck, title: "Numbers you can trust", desc: "Every figure comes from a deterministic engine, with full provenance." },
];

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden text-white" style={{ background: "radial-gradient(1200px 600px at 20% -10%, #16337a 0%, #0b1f4d 45%, #060f26 100%)" }}>
      {/* Floating gradient orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="tiq-float absolute -left-24 top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="tiq-float absolute right-0 top-1/3 h-80 w-80 rounded-full bg-blue-600/20 blur-3xl" style={{ animationDelay: "1.5s" }} />
        <div className="tiq-float absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" style={{ animationDelay: "3s" }} />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6">
        {/* Nav */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white px-3 py-2 shadow-lg"><NivaBupaLogo style={{ width: 104, height: 42, display: "block" }} /></div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold">Territory IQ</div>
              <div className="text-[10px] text-cyan-200/70">New Business Command Center</div>
            </div>
          </div>
          <Link href="/login" className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/20">Sign in</Link>
        </header>

        {/* Hero */}
        <main className="flex flex-1 flex-col items-center justify-center py-14 text-center">
          <div className="tiq-fade-up mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
            <Zap className="h-3.5 w-3.5" /> AI-powered · built for Territory Heads
          </div>
          <h1 className="tiq-fade-up max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl" style={{ animationDelay: "0.05s" }}>
            Your territory,<br /><span className="bg-gradient-to-r from-cyan-300 to-amber-300 bg-clip-text text-transparent">understood in 10 seconds.</span>
          </h1>
          <p className="tiq-fade-up mt-5 max-w-xl text-base text-blue-100/80 sm:text-lg" style={{ animationDelay: "0.1s" }}>
            Stop scrolling Excel. Upload your New Business report and get a live command center, a Tanglish AI analyst, prioritized call lists, and branded reports — with numbers you can trust.
          </p>
          <div className="tiq-fade-up mt-8 flex flex-col items-center gap-3 sm:flex-row" style={{ animationDelay: "0.15s" }}>
            <Link href="/login" className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-blue-500">
              Enter the live demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#features" className="rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5">See what it does</a>
          </div>

          {/* Stats */}
          <div className="tiq-fade-up mt-14 grid w-full max-w-2xl grid-cols-3 gap-6 rounded-2xl border border-white/10 bg-white/5 py-6 backdrop-blur" style={{ animationDelay: "0.2s" }}>
            <Stat target={10} suffix="s" label="to a dashboard" />
            <Stat target={100} suffix="%" label="verified numbers" />
            <Stat target={96} label="columns parsed" />
          </div>
        </main>

        {/* Features */}
        <section id="features" className="pb-14">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur transition hover:border-cyan-300/30 hover:bg-white/10">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200"><f.icon className="h-[18px] w-[18px]" /></span>
                <div className="mt-3 font-semibold">{f.title}</div>
                <div className="mt-1 text-sm text-blue-100/70">{f.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-white/10 py-5 text-center text-xs text-white/40">
          Niva Bupa Health Insurance · Territory IQ · built by DigitalVetri.AI
        </footer>
      </div>
    </div>
  );
}
