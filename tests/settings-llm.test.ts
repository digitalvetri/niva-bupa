// The bot API key is stored server-side but must NEVER be returned raw by the API (masked).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma, TEST_TENANT_ID } from "./helpers";
import { ensureDevTenant } from "../lib/tenant";
import { getSettings } from "../lib/nudge/settings";
import { GET as settingsGET, POST as settingsPOST } from "../app/api/settings/route";

const SECRET = "gsk_supersecret_9999";

function req(method: "GET" | "POST", body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/settings", {
    method,
    headers: { "x-tenant-id": TEST_TENANT_ID, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(async () => {
  await ensureDevTenant(prisma, TEST_TENANT_ID);
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("§11 API key handling", () => {
  it("stores the key server-side but masks it on the API", async () => {
    const post = await settingsPOST(req("POST", { llm: { provider: "groq", apiKey: SECRET, model: "llama-3.3-70b-versatile" } }));
    const posted = await post.json();
    // POST response is masked too — never echoes the raw key.
    expect(JSON.stringify(posted)).not.toContain(SECRET);
    expect(posted.settings.llm.configured).toBe(true);
    expect(posted.settings.llm.keyLast4).toBe("9999");
    expect(posted.settings.llm.provider).toBe("groq");

    // GET is masked.
    const get = await settingsGET(req("GET"));
    const view = await get.json();
    expect(JSON.stringify(view)).not.toContain(SECRET);
    expect(view.llm.keyLast4).toBe("9999");

    // But the bot CAN read the real key server-side.
    const s = await getSettings(prisma, TEST_TENANT_ID);
    expect(s.llm?.apiKey).toBe(SECRET);
  });

  it("blank apiKey leaves the stored key unchanged (edit model without re-entering key)", async () => {
    await settingsPOST(req("POST", { llm: { provider: "groq", apiKey: "", model: "llama-3.1-8b-instant" } }));
    const s = await getSettings(prisma, TEST_TENANT_ID);
    expect(s.llm?.apiKey).toBe(SECRET); // key preserved
    expect(s.llm?.model).toBe("llama-3.1-8b-instant"); // model updated
  });

  it("rejects an unknown provider", async () => {
    const res = await settingsPOST(req("POST", { llm: { provider: "cohere", apiKey: "x" } }));
    expect(res.status).toBe(400);
  });

  it("clear removes the key", async () => {
    await settingsPOST(req("POST", { llm: { clear: true } }));
    const s = await getSettings(prisma, TEST_TENANT_ID);
    expect(s.llm?.apiKey).toBeUndefined();
  });
});
