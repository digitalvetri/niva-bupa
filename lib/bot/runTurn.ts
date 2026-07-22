// §7 orchestration: route -> execute deterministic metrics -> narrate -> drift-check -> persist.
// Exposed as an async generator of events the /api/chat route pipes to SSE.
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getMetric } from "../metrics/catalog";
import { compareMetric } from "../metrics/compare";
import type { Filters, MetricResult } from "../metrics/types";
import { routeQuestion, type ChatTurn } from "./router";
import { narrate } from "./narrator";
import { detectLanguage } from "./transliterate";
import { checkNumericDrift } from "./numericGuard";
import { captureError } from "../observability";

export type ChatContext = { tenantId: string; userId: string };
export type ChatBody = { snapshotId: string; messages: ChatTurn[]; filters?: Filters; compareSnapshotId?: string };

export type ToolTraceEntry = { metric: string; filters: Filters; rowsMatched: number; resultHash: string };
export type Provenance = { rowsMatched: number; filters: Filters; snapshotId: string; metrics: string[] };

export type TurnEvent =
  | { type: "token"; text: string }
  | { type: "done"; scope: "in" | "out"; toolTrace: ToolTraceEntry[]; provenance: Provenance | null; drift: { ok: boolean; offending: string[] }; needsInterpretation: boolean }
  | { type: "error"; message: string };

function mergeFilters(base: Filters | undefined, override: Filters): Filters {
  return { ...(base ?? {}), ...override };
}

function hashResult(data: unknown): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16);
}

export async function* runTurn(db: PrismaClient, ctx: ChatContext, body: ChatBody): AsyncGenerator<TurnEvent, void, unknown> {
  const history = body.messages;
  const question = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  let assistantText = "";
  const persist = async (toolTrace: ToolTraceEntry[]) => {
    await db.chatMessage.create({ data: { tenantId: ctx.tenantId, userId: ctx.userId, snapshotId: body.snapshotId, role: "user", content: question } });
    await db.chatMessage.create({ data: { tenantId: ctx.tenantId, userId: ctx.userId, snapshotId: body.snapshotId, role: "assistant", content: assistantText, toolTrace: toolTrace as object } });
  };

  // 1. Route (LLM). Fail with a human-readable message, not a raw SDK error.
  let routed;
  try {
    routed = await routeQuestion(history);
  } catch (e) {
    captureError(e, { stage: "router", tenant: ctx.tenantId });
    yield { type: "error", message: "The assistant is unavailable right now (routing failed). Please try again in a moment." };
    return;
  }

  // 2a. Out of scope — polite decline, no narrator, no invented numbers (§13.14).
  if (routed.scope === "out") {
    assistantText = routed.message;
    yield { type: "token", text: routed.message };
    await persist([]);
    yield { type: "done", scope: "out", toolTrace: [], provenance: null, drift: { ok: true, offending: [] }, needsInterpretation: false };
    return;
  }

  // 2b. Execute the chosen metric functions (deterministic — the ONLY source of numbers).
  const executed: { metric: string; filters: Filters; result: MetricResult }[] = [];
  for (const call of routed.calls) {
    if (call.metricId === "snapshot_compare") {
      const { metric, ...rest } = call.filters as Filters & { metric?: string };
      const filters = mergeFilters(body.filters, rest);
      if (!body.compareSnapshotId) {
        executed.push({ metric: "snapshot_compare", filters, result: { id: "snapshot_compare", data: { note: "No comparison snapshot selected — pick one in the top bar to see week-over-week deltas." }, meta: { rowsMatched: 0, filtersApplied: filters, snapshotId: body.snapshotId, computedAt: new Date().toISOString() } } });
        continue;
      }
      const result = await compareMetric(db, metric ?? "premium_by_branch", body.snapshotId, body.compareSnapshotId, filters);
      executed.push({ metric: "snapshot_compare", filters, result });
      continue;
    }
    const entry = getMetric(call.metricId);
    if (!entry) continue;
    const filters = mergeFilters(body.filters, call.filters);
    const result = await entry.fn(db, body.snapshotId, filters);
    executed.push({ metric: call.metricId, filters, result });
  }
  if (executed.length === 0) {
    const msg = "I couldn't find a metric for that. Try premium, branches, agents, products, or stuck cases.";
    assistantText = msg;
    yield { type: "token", text: msg };
    await persist([]);
    yield { type: "done", scope: "out", toolTrace: [], provenance: null, drift: { ok: true, offending: [] }, needsInterpretation: false };
    return;
  }

  const toolResults = executed.map((e) => ({ metric: e.metric, filters: e.filters, ...e.result }));

  // 3. Narrate (streaming). Numbers come only from toolResults.
  try {
    for await (const delta of narrate({ question, language: detectLanguage(question), toolResults, needsInterpretation: routed.needsInterpretation })) {
      assistantText += delta;
      yield { type: "token", text: delta };
    }
  } catch (e) {
    captureError(e, { stage: "narrator", tenant: ctx.tenantId });
    const timedOut = /timeout|timed out|ETIMEDOUT|aborted/i.test((e as Error).message);
    yield { type: "error", message: timedOut ? "The assistant took too long to respond. Please try again." : "The assistant hit an error while writing the answer. Please try again." };
    return;
  }

  // 4. Drift guard + provenance.
  const drift = checkNumericDrift(assistantText, toolResults);
  const primary = executed[0]!;
  const toolTrace: ToolTraceEntry[] = executed.map((e) => ({ metric: e.metric, filters: e.filters, rowsMatched: e.result.meta.rowsMatched, resultHash: hashResult(e.result.data) }));
  const provenance: Provenance = { rowsMatched: primary.result.meta.rowsMatched, filters: primary.filters, snapshotId: body.snapshotId, metrics: executed.map((e) => e.metric) };

  await persist(toolTrace);
  yield { type: "done", scope: "in", toolTrace, provenance, drift, needsInterpretation: routed.needsInterpretation };
}
