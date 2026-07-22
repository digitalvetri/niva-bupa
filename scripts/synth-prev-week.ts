// Dev-only: ingest a synthetic "previous week" snapshot into the dev DB so the compare picker
// and WoW deltas can be demoed. TEST DATA — filename is suffixed _SYNTHETIC; never a prod seed.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { ingestCsv } from "../lib/ingest/ingest";
import { ensureDevTenant } from "../lib/tenant";
import { synthPrevWeekCsv, SYNTH_PREV_FILENAME } from "../lib/dev/synth";

const prisma = new PrismaClient();
const TENANT = process.env.DEFAULT_TENANT_ID ?? "00000000-0000-0000-0000-000000000001";

async function main() {
  await ensureDevTenant(prisma, TENANT);
  const csv = synthPrevWeekCsv(readFileSync("fixtures/nb_sample.csv", "utf8"));
  const res = await ingestCsv(prisma, { tenantId: TENANT, uploadedById: "synth", fileName: SYNTH_PREV_FILENAME, content: csv });
  console.log(`synthetic prev-week snapshot: ${res.status} · ${res.rowCount} cases · ${res.snapshotId}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
