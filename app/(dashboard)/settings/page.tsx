"use client";
import * as React from "react";
import { Save, Loader2, CheckCircle2, Upload, KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle, Button, Input } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock } from "@/components/dashboard/states";
import { PROVIDERS, defaultModelFor, type ProviderId } from "@/lib/bot/providers/types";

type LlmView = { provider: ProviderId | null; model: string | null; configured: boolean; keyLast4: string | null; source: "settings" | "env" | null };
type Settings = { high_value_threshold: number; currency: string; agentPhones: Record<string, string>; llm: LlmView };

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [threshold, setThreshold] = React.useState("");
  const [csv, setCsv] = React.useState("");
  // LLM form
  const [provider, setProvider] = React.useState<ProviderId>("anthropic");
  const [apiKey, setApiKey] = React.useState("");
  const [model, setModel] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback((s: Settings) => {
    setSettings(s);
    setThreshold(String(s.high_value_threshold));
    if (s.llm.provider) setProvider(s.llm.provider);
    setModel(s.llm.model ?? "");
  }, []);

  React.useEffect(() => {
    fetch("/api/settings", { cache: "no-store" }).then((r) => r.json()).then(load);
  }, [load]);

  async function post(patch: Record<string, unknown>, label: string) {
    setBusy(true);
    setSaved(null);
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      const j = await r.json();
      if (!r.ok) { setSaved(j.error ?? "Save failed"); return; }
      load(j.settings);
      setSaved(patch.agentPhonesCsv ? `Imported ${j.imported} agent phone${j.imported === 1 ? "" : "s"}` : label);
      setCsv("");
      setApiKey("");
    } finally {
      setBusy(false);
      setTimeout(() => setSaved(null), 3000);
    }
  }

  if (!settings) return (<><PageHeader title="Settings" /><LoadingBlock className="h-40" /></>);

  const llm = settings.llm;
  const activeProviderLabel = PROVIDERS.find((p) => p.id === llm.provider)?.label;

  return (
    <>
      <PageHeader title="Settings" subtitle="Territory configuration" right={saved ? <span className="inline-flex items-center gap-1 text-sm text-won"><CheckCircle2 className="h-4 w-4" /> {saved}</span> : undefined} />

      {/* AI provider */}
      <Card className="mb-4">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> AI provider (Ask Territory IQ)</CardTitle>
          {llm.configured && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--won)]/15 px-2 py-0.5 text-xs text-won">
              <ShieldCheck className="h-3.5 w-3.5" /> {llm.source === "env" ? "using env key" : `${activeProviderLabel ?? "configured"} · ••••${llm.keyLast4 ?? ""}`}
            </span>
          )}
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-fg-muted">Choose the model provider that powers the chat bot and paste its API key. Claude is recommended; Groq, Gemini and OpenAI-compatible keys also work. The key is stored server-side and never shown again.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-fg-subtle">Provider</span>
              <select
                value={provider}
                onChange={(e) => { setProvider(e.target.value as ProviderId); setModel(""); }}
                className="h-9 w-full rounded-lg border bg-surface px-3 text-sm text-fg focus:border-primary focus:outline-none"
              >
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}{p.recommended ? " — recommended" : ""}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-fg-subtle">Model <span className="text-fg-subtle/70">(optional)</span></span>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={defaultModelFor(provider)} />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-fg-subtle">API key</span>
            <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={llm.configured ? "•••••••••••• (leave blank to keep current)" : (PROVIDERS.find((p) => p.id === provider)?.keyHint ?? "API key")} />
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => post({ llm: { provider, apiKey, model } }, "AI provider saved")} disabled={busy || (!apiKey.trim() && (provider === llm.provider) && (model === (llm.model ?? "")))}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save provider
            </Button>
            {llm.source === "settings" && (
              <Button variant="ghost" size="sm" onClick={() => post({ llm: { clear: true } }, "Cleared")} disabled={busy}>Remove key</Button>
            )}
          </div>
          {!llm.configured && <p className="text-xs text-pending">The bot is disabled until a provider key is configured (or ANTHROPIC_API_KEY is set in the environment).</p>}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>High-value threshold</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-fg-muted">Cases with logged premium at or above this are treated as high-value in the follow-up list (<code className="text-fg">high_value_stuck</code> — "who should I call today").</p>
            <div className="flex items-center gap-2">
              <span className="text-fg-subtle">₹</span>
              <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="max-w-[180px]" />
              <Button size="sm" onClick={() => post({ high_value_threshold: Number(threshold) }, "Threshold saved")} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Agent phone mapping</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-fg-muted">Upload a CSV of <code className="text-fg">agent_code,phone</code> so nudges can reach agents on WhatsApp. {Object.keys(settings.agentPhones).length} on file.</p>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} placeholder={"agent_code,phone\nA123,+919876543210"} className="w-full resize-none rounded-lg border bg-surface-2 p-3 font-mono text-xs text-fg focus:border-primary focus:outline-none" />
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); e.target.value = ""; }} />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Choose CSV</Button>
              <Button size="sm" onClick={() => post({ agentPhonesCsv: csv }, "Imported")} disabled={busy || !csv.trim()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Import
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
