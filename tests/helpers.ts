import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { ingestCsv } from "../lib/ingest/ingest.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PATH = resolve(__dirname, "../fixtures/nb_sample.csv");
export const TEST_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export const prisma = new PrismaClient();

export function readFixture(): string {
  return readFileSync(FIXTURE_PATH, "utf8");
}

/** Ensure the test tenant exists and the fixture is ingested exactly once (dedup by hash). */
export async function ensureFixture(): Promise<{ tenantId: string; snapshotId: string }> {
  await prisma.tenant.upsert({
    where: { id: TEST_TENANT_ID },
    update: {},
    create: { id: TEST_TENANT_ID, name: "Test Territory", settings: { high_value_threshold: 50000, currency: "INR" } },
  });
  const res = await ingestCsv(prisma, {
    tenantId: TEST_TENANT_ID,
    uploadedById: "test-user",
    fileName: "nb_sample.csv",
    content: readFixture(),
  });
  return { tenantId: TEST_TENANT_ID, snapshotId: res.snapshotId };
}
