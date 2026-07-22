// §9 WhatsApp nudge: deterministic AI-style draft from case context, queue with 20/day/user cap,
// resolve agent phone from settings, POST to the n8n webhook (WhatsApp Cloud API), log everything.
import type { PrismaClient } from "@prisma/client";
import { getSettings } from "./settings";

export { draftNudge, type CaseContext } from "./draft";

export const DAILY_NUDGE_CAP = 20;

export type NudgeInput = {
  tenantId: string;
  userId: string;
  caseId: string; // applicationNo (business key)
  toName: string; // agent name
  agentCode: string | null;
  message: string;
};

export type NudgeResult =
  | { status: "SENT" | "QUEUED"; nudgeId: string; toPhone: string }
  | { status: "FALLBACK"; nudgeId: string; reason: "no_phone"; message: string } // copy-to-clipboard
  | { status: "BLOCKED"; reason: "daily_cap"; sentToday: number };

/** Start of today (UTC) for the per-user daily cap window. */
function startOfDayUtc(nowMs: number): Date {
  const d = new Date(nowMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function queueNudge(db: PrismaClient, input: NudgeInput, nowMs: number): Promise<NudgeResult> {
  // Guardrail: max 20 nudges/day/user (§9). Count THIS user's non-blocked nudges today.
  const sentToday = await db.nudgeLog.count({
    where: { tenantId: input.tenantId, userId: input.userId, createdAt: { gte: startOfDayUtc(nowMs) }, status: { in: ["QUEUED", "SENT"] } },
  });
  if (sentToday >= DAILY_NUDGE_CAP) return { status: "BLOCKED", reason: "daily_cap", sentToday };

  const settings = await getSettings(db, input.tenantId);
  const phone = input.agentCode ? settings.agentPhones[input.agentCode] : undefined;

  // Missing phone -> copy-to-clipboard fallback (§9). Log it so nothing is silent.
  if (!phone) {
    const log = await db.nudgeLog.create({ data: { tenantId: input.tenantId, userId: input.userId, caseId: input.caseId, toName: input.toName, toPhone: null, message: input.message, status: "FAILED" } });
    return { status: "FALLBACK", nudgeId: log.id, reason: "no_phone", message: input.message };
  }

  const log = await db.nudgeLog.create({ data: { tenantId: input.tenantId, userId: input.userId, caseId: input.caseId, toName: input.toName, toPhone: phone, message: input.message, status: "QUEUED" } });

  // POST to the n8n webhook (which calls the WhatsApp Cloud API). Optimistically mark SENT on 2xx;
  // the n8n callback can later reconcile. Without a configured webhook, it stays QUEUED.
  const webhook = process.env.N8N_NUDGE_WEBHOOK;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nudgeId: log.id, toPhone: phone, toName: input.toName, caseId: input.caseId, message: input.message }),
      });
      if (res.ok) {
        await db.nudgeLog.update({ where: { id: log.id }, data: { status: "SENT" } });
        return { status: "SENT", nudgeId: log.id, toPhone: phone };
      }
    } catch {
      // fall through — leave QUEUED for retry/callback
    }
  }
  return { status: "QUEUED", nudgeId: log.id, toPhone: phone };
}
