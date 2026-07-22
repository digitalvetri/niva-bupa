// POST /api/chat — bot turn (§7). Body: { snapshotId, messages[], filters? } -> SSE stream.
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { contextFromRequest } from "@/lib/auth";
import { runTurn, type ChatBody } from "@/lib/bot/runTurn";
import { hasAnthropicCredentials } from "@/lib/bot/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { tenantId, userId } = contextFromRequest(req);
  if (!tenantId) return json({ error: "Missing tenant" }, 401);
  if (!hasAnthropicCredentials()) {
    return json({ error: "The bot needs Anthropic credentials. Set ANTHROPIC_API_KEY (or run `ant auth login`) and restart the server." }, 503);
  }

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.snapshotId) return json({ error: "snapshotId is required" }, 400);
  if (!Array.isArray(body.messages) || body.messages.length === 0) return json({ error: "messages[] is required" }, 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      try {
        for await (const event of runTurn(prisma, { tenantId, userId }, body)) {
          send(event);
        }
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
