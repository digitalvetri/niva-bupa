"use client";
import * as React from "react";
import { MessageSquare, X, Send, Loader2, AlertTriangle, Database } from "lucide-react";
import { useDashboard } from "./provider";
import { STAGE_LABEL } from "@/lib/theme";
import { cn } from "@/lib/utils";

type Provenance = { rowsMatched: number; filters: Record<string, unknown>; snapshotId: string; metrics: string[] };
type Msg = {
  role: "user" | "assistant";
  content: string;
  provenance?: Provenance | null;
  metrics?: string[];
  drift?: { ok: boolean; offending: string[] };
  scope?: "in" | "out";
  streaming?: boolean;
};

const SUGGESTIONS = [
  "Total logged premium?",
  "Salem la evlo pending irukku?",
  "Top agent yaaru?",
  "Yaaru follow up pannanum innaiku?",
];

export function ChatDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snapshotId, compareId, filters } = useDashboard();
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !snapshotId) return;
    setInput("");
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshotId, compareSnapshotId: compareId ?? undefined, filters, messages: history.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        patchLast({ content: err.error ?? "Something went wrong.", streaming: false, scope: "out" });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));
          if (event.type === "token") patchLast((m) => ({ content: m.content + event.text }));
          else if (event.type === "done") patchLast({ streaming: false, provenance: event.provenance, metrics: event.provenance?.metrics, drift: event.drift, scope: event.scope });
          else if (event.type === "error") patchLast({ content: (messages.at(-1)?.content ?? "") + `\n\n⚠️ ${event.message}`, streaming: false });
        }
      }
      patchLast({ streaming: false });
    } catch (e) {
      patchLast({ content: `⚠️ ${(e as Error).message}`, streaming: false });
    } finally {
      setBusy(false);
    }
  }

  function patchLast(patch: Partial<Msg> | ((m: Msg) => Partial<Msg>)) {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last) return prev;
      next[next.length - 1] = { ...last, ...(typeof patch === "function" ? patch(last) : patch) };
      return next;
    });
  }

  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col border-l bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="h-4 w-4 text-primary" /> Ask Territory IQ</div>
        <button onClick={onClose} className="text-fg-subtle hover:text-fg"><X className="h-4 w-4" /></button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">Ask in English, Tamil, or Tanglish. Every number is verified against the metric engine for the current snapshot & filters.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border bg-surface-2 px-3 py-1 text-xs text-fg-muted hover:text-fg">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm", m.role === "user" ? "bg-primary text-primary-fg" : "border bg-surface-2 text-fg")}>
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}{m.streaming && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</div>
              {m.role === "assistant" && !m.streaming && m.provenance && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2 text-[11px] text-fg-subtle">
                  <span className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.5"><Database className="h-3 w-3" />{m.provenance.rowsMatched} rows</span>
                  {(m.metrics ?? []).map((mt) => <span key={mt} className="rounded bg-surface px-1.5 py-0.5">{mt}</span>)}
                  {activeFilterLabels(m.provenance.filters).map((f) => <span key={f} className="rounded bg-surface px-1.5 py-0.5">{f}</span>)}
                  <span className="rounded bg-surface px-1.5 py-0.5">snapshot {m.provenance.snapshotId.slice(0, 8)}</span>
                </div>
              )}
              {m.role === "assistant" && !m.streaming && m.drift && !m.drift.ok && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-action"><AlertTriangle className="h-3 w-3" /> unverified: {m.drift.offending.join(", ")}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(input); }}
        className="flex items-center gap-2 border-t p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={snapshotId ? "Ask about this report…" : "Upload a report first"}
          disabled={!snapshotId || busy}
          className="h-9 flex-1 rounded-lg border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none"
        />
        <button type="submit" disabled={!snapshotId || busy || !input.trim()} className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-fg disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

function activeFilterLabels(filters: Record<string, unknown>): string[] {
  const out: string[] = [];
  const f = filters as { branch?: string[]; funnelStage?: string[]; bucket?: string[]; isPortability?: boolean; minLoggedPremium?: number };
  if (f.branch?.length) out.push(f.branch.join(", "));
  if (f.funnelStage?.length) out.push(f.funnelStage.map((s) => STAGE_LABEL[s] ?? s).join(", "));
  if (f.bucket?.length) out.push(f.bucket.join(", "));
  if (f.isPortability) out.push("Port");
  if (f.minLoggedPremium) out.push(`≥₹${f.minLoggedPremium}`);
  return out;
}
