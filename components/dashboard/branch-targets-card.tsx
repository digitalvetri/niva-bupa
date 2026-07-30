"use client";
import * as React from "react";
import { Target, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@/components/ui/primitives";

// Enter monthly business targets per branch — powers the Territory Achievement bar on Pulse and
// the achievement gauge on the report posters. Format: one "Branch,Amount" per line.
export function BranchTargetsCard() {
  const [text, setText] = React.useState("");
  const [count, setCount] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        const t = (s?.branchTargets ?? {}) as Record<string, number>;
        setCount(Object.keys(t).length);
        setText(Object.entries(t).map(([b, v]) => `${b},${v}`).join("\n"));
      })
      .catch(() => {});
  }, []);

  function parse(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const line of text.split(/\r?\n/)) {
      const [b, v] = line.split(",").map((x) => x.trim());
      if (!b || /branch/i.test(b)) continue; // skip header/blank
      const n = Number((v ?? "").replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n > 0) out[b] = Math.round(n);
    }
    return out;
  }

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const branchTargets = parse();
      const r = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ branchTargets }) });
      const j = await r.json();
      setCount(Object.keys(j?.settings?.branchTargets ?? branchTargets).length);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" /> Branch targets</CardTitle>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-won"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-sm text-fg-muted">Monthly business target per branch, one <code className="text-fg">Branch,Amount</code> per line. Powers the <strong className="text-fg">Territory Achievement</strong> bar on Pulse and the achievement gauge on report posters. {count} set.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={"Salem,1000000\nErode,800000\nCoimbatore,600000"}
          className="w-full resize-none rounded-lg border bg-surface-2 p-3 font-mono text-xs text-fg focus:border-primary focus:outline-none"
        />
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save targets
        </Button>
      </CardBody>
    </Card>
  );
}
