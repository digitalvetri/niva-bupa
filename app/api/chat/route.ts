// POST /api/chat — bot turn (§7). Body: { snapshotId, messages[], filters? } -> SSE stream.
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { requireSnapshot, scopedFilters, AccessError } from "@/lib/access";
import { rateLimit } from "@/lib/ratelimit";
import { runTurn, type ChatBody } from "@/lib/bot/runTurn";
import { hasAnthropicCredentials } from "@/lib/bot/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHAT_LIMIT = { limit: 30, windowMs: 60_000 }; // 30 turns/min/user

export async function POST(req: NextRequest) {
  const ctx = contextFromRequest(req);
  if (!ctx.tenantId) return json({ error: "Missing tenant" }, 401);
  if (!hasAnthropicCredentials()) {
    return json({ error: "The bot needs Anthropic credentials. Set ANTHROPIC_API_KEY (or run `ant auth login`) and restart the server." }, 503);
  }

  const rl = rateLimit(`chat:${ctx.tenantId}:${ctx.userId}`, CHAT_LIMIT.limit, CHAT_LIMIT.windowMs);
  if (!rl.ok) return json({ error: `Too many questions — try again in ${rl.retryAfterSec}s.` }, 429);

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.snapshotId) return json({ error: "snapshotId is required" }, 400);
  if (!Array.isArray(body.messages) || body.messages.length === 0) return json({ error: "messages[] is required" }, 400);

  // Tenant isolation + branch scoping before any data is read.
  try {
    await requireSnapshot(prisma, body.snapshotId, ctx);
    if (body.compareSnapshotId) await requireSnapshot(prisma, body.compareSnapshotId, ctx);
  } catch (e) {
    if (e instanceof AccessError) return json({ error: e.message }, e.status);
    throw e;
  }
  body.filters = scopedFilters(body.filters ?? {}, ctx);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        for await (const event of runTurn(prisma, { tenantId: ctx.tenantId, userId: ctx.userId }, body)) send(event);
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}

function json(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}
