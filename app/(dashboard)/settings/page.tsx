"use client";
import * as React from "react";
import { Save, Loader2, CheckCircle2, Upload } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle, Button, Input } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock } from "@/components/dashboard/states";

type Settings = { high_value_threshold: number; currency: string; agentPhones: Record<string, string> };

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<Settings | null>(null);
  const [threshold, setThreshold] = React.useState("");
  const [csv, setCsv] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: Settings) => { setSettings(s); setThreshold(String(s.high_value_threshold)); });
  }, []);

  async function save(patch: { high_value_threshold?: number; agentPhonesCsv?: string }, label: string) {
    setBusy(true);
    setSaved(null);
    try {
      const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
      const j = await r.json();
      setSettings(j.settings);
      setSaved(patch.agentPhonesCsv ? `Imported ${j.imported} agent phone${j.imported === 1 ? "" : "s"}` : label);
      setCsv("");
    } finally {
      setBusy(false);
      setTimeout(() => setSaved(null), 2500);
    }
  }

  if (!settings) return (<><PageHeader title="Settings" /><LoadingBlock className="h-40" /></>);

  return (
    <>
      <PageHeader title="Settings" subtitle="Territory configuration" right={saved ? <span className="inline-flex items-center gap-1 text-sm text-won"><CheckCircle2 className="h-4 w-4" /> {saved}</span> : undefined} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>High-value threshold</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-fg-muted">Cases with logged premium at or above this are flagged high-value (used by the attention banner and follow-up list).</p>
            <div className="flex items-center gap-2">
              <span className="text-fg-subtle">₹</span>
              <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="max-w-[180px]" />
              <Button size="sm" onClick={() => save({ high_value_threshold: Number(threshold) }, "Threshold saved")} disabled={busy}>
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
              <Button size="sm" onClick={() => save({ agentPhonesCsv: csv }, "Imported")} disabled={busy || !csv.trim()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Import
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
