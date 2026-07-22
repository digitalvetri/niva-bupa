"use client";
import * as React from "react";
import { X, Send, Loader2, CheckCircle2, Copy, AlertTriangle, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { draftNudge, type CaseContext } from "@/lib/nudge/draft";
import type { StuckCaseRow } from "@/lib/metrics/metrics";
import { cn } from "@/lib/utils";

const TH_NAME = "Territory Head";

type NudgeResp =
  | { status: "SENT" | "QUEUED"; toPhone: string }
  | { status: "FALLBACK"; reason: "no_phone"; message: string }
  | { status: "BLOCKED"; reason: "daily_cap"; sentToday: number }
  | { error: string };

export function NudgeModal({ row, onClose }: { row: StuckCaseRow; onClose: () => void }) {
  const ctx: CaseContext = {
    applicationNo: row.applicationNo, customerName: row.customerName, agentName: row.agentName, agentCode: row.agentCode,
    loggedPremium: row.loggedPremium, productGenre: row.productGenre, leadStatus: row.leadStatus, ageingDays: row.ageingDays,
  };
  const [message, setMessage] = React.useState(() => draftNudge(ctx, TH_NAME));
  const [busy, setBusy] = React.useState(false);
  const [resp, setResp] = React.useState<NudgeResp | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function send() {
    setBusy(true);
    setResp(null);
    try {
      const r = await fetch("/api/nudge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId: row.applicationNo, toName: row.agentName, agentCode: row.agentCode, message }),
      });
      setResp((await r.json()) as NudgeResp);
    } catch (e) {
      setResp({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium"><MessageCircle className="h-4 w-4 text-[color:var(--won)]" /> Nudge on WhatsApp</div>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3 p-4">
          <div className="text-xs text-fg-muted">
            To <span className="text-fg">{row.agentName}</span>{row.agentCode ? ` (${row.agentCode})` : ""} · case {row.applicationNo} · {row.display.loggedFull}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-lg border bg-surface-2 p-3 text-sm text-fg focus:border-primary focus:outline-none"
          />

          {resp && "status" in resp && (resp.status === "SENT" || resp.status === "QUEUED") && (
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--won)]/30 bg-[color:var(--won)]/10 px-3 py-2 text-sm text-fg">
              <CheckCircle2 className="h-4 w-4 text-won" /> {resp.status === "SENT" ? "Sent" : "Queued"} to {resp.toPhone}
            </div>
          )}
          {resp && "status" in resp && resp.status === "FALLBACK" && (
            <div className="rounded-lg border border-[color:var(--pending)]/30 bg-[color:var(--pending)]/10 px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-fg"><AlertTriangle className="h-4 w-4 text-pending" /> No phone on file for this agent.</div>
              <div className="mt-1 text-xs text-fg-muted">Add it in Settings, or copy the message and send it manually.</div>
            </div>
          )}
          {resp && "status" in resp && resp.status === "BLOCKED" && (
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--action)]/30 bg-[color:var(--action)]/10 px-3 py-2 text-sm text-fg">
              <AlertTriangle className="h-4 w-4 text-action" /> Daily nudge limit reached ({resp.sentToday}/20). Try again tomorrow.
            </div>
          )}
          {resp && "error" in resp && (
            <div className="flex items-center gap-2 rounded-lg border border-[color:var(--action)]/30 bg-[color:var(--action)]/10 px-3 py-2 text-sm text-fg"><AlertTriangle className="h-4 w-4 text-action" /> {resp.error}</div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-won" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" onClick={send} disabled={busy || !message.trim()} className={cn(resp && "status" in resp && resp.status !== "BLOCKED" && "opacity-80")}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send nudge
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
