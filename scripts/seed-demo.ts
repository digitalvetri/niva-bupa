// Seed a DEMO tenant with anonymized data so the app can be demoed without exposing real
// customer names (§11 / §12 Phase 5). Idempotent (dedupe by hash).
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { ingestCsv } from "../lib/ingest/ingest";
import { anonymizeCsv, DEMO_TENANT_ID, ANON_FILENAME } from "../lib/dev/anonymize";

const prisma = new PrismaClient();

async function main() {
  await prisma.tenant.upsert({
    where: { id: DEMO_TENANT_ID },
    update: {},
    create: { id: DEMO_TENANT_ID, name: "Demo Territory (anonymized)", settings: { high_value_threshold: 50000, currency: "INR" } },
  });
  const anon = anonymizeCsv(readFileSync("fixtures/nb_sample.csv", "utf8"));
  const res = await ingestCsv(prisma, { tenantId: DEMO_TENANT_ID, uploadedById: "seed", fileName: ANON_FILENAME, content: anon });
  console.log(`demo tenant ${DEMO_TENANT_ID}: ${res.status} · ${res.rowCount} cases · snapshot ${res.snapshotId}`);
  console.log(`Set DEFAULT_TENANT_ID=${DEMO_TENANT_ID} (or send x-tenant-id) to browse the anonymized demo.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
