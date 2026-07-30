"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Loader2, Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
import { NivaBupaLogo } from "@/components/brand/niva-bupa-logo";

// Three.js scene is client-only (WebGL) — load it without SSR.
const ThreeBackground = dynamic(() => import("./three-background"), { ssr: false });

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("arunkodi@gmail.com");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error ?? "Login failed. Please try again.");
        return;
      }
      const from = new URLSearchParams(window.location.search).get("from");
      router.replace(from && from.startsWith("/") ? from : "/pulse");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 text-white" style={{ background: "#0a1b3f" }}>
      <ThreeBackground />

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-[400px] rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-2xl sm:p-9">
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/10 to-transparent" />
        <div className="relative">
          {/* Logo */}
          <div className="mb-6 flex flex-col items-center gap-4 text-center">
            <div className="rounded-2xl bg-white px-4 py-3 shadow-lg">
              <NivaBupaLogo style={{ width: 132, height: 53, display: "block" }} />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">Territory IQ</div>
              <div className="text-xs text-cyan-200/80">New Business Command Center</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/70">Email</span>
              <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 focus-within:border-cyan-300/70">
                <Mail className="h-4 w-4 text-white/50" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  className="h-11 w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/70">Password</span>
              <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 focus-within:border-cyan-300/70">
                <Lock className="h-4 w-4 text-white/50" />
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
                  placeholder="••••••••"
                  required
                />
                <button type="button" onClick={() => setShow((s) => !s)} className="text-white/50 hover:text-white/80" aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-lg border border-red-300/30 bg-red-500/15 px-3 py-2 text-xs text-red-100">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:from-cyan-400 hover:to-blue-500 disabled:opacity-70"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
            </button>
          </form>

          <div className="mt-6 text-center text-[11px] text-white/40">
            Niva Bupa Health Insurance · DigitalVetri.AI
          </div>
        </div>
      </div>
    </div>
  );
}
