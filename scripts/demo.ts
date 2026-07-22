// End-to-end demo: ingest the fixture and print the six Phase-1 metrics as they'd come off the API.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { ingestCsv } from "../lib/ingest/ingest";
import { totals, premiumByBranch, funnel, stuckCases, agentLeaderboard, stuckSummary } from "../lib/metrics/metrics";

const prisma = new PrismaClient();
const TENANT = "00000000-0000-0000-0000-000000000001";

async function main() {
  await prisma.tenant.upsert({ where: { id: TENANT }, update: {}, create: { id: TENANT, name: "Demo Territory", settings: { high_value_threshold: 50000 } } });
  const ing = await ingestCsv(prisma, { tenantId: TENANT, uploadedById: "demo", fileName: "nb_sample.csv", content: readFileSync("fixtures/nb_sample.csv", "utf8") });
  console.log(`\n=== INGEST ===  status=${ing.status} cases=${ing.rowCount} issues=${ing.issueCount} durationMs=${ing.durationMs}`);
  const sid = ing.snapshotId;

  const t = (await totals(prisma, sid, {})).data;
  console.log(`\n=== totals ===`);
  console.log(`  logged=${t.display.logged} (${t.logged_premium})  issued=${t.display.issued} (${t.issued_premium})`);
  console.log(`  cases=${t.case_count}  issued=${t.issued_count}  conversion=${t.conversion_pct}%  avg_ticket=${t.display.avg_ticket}`);

  console.log(`\n=== premium_by_branch (top 3) ===`);
  for (const b of (await premiumByBranch(prisma, sid, {})).data.slice(0, 3)) console.log(`  ${b.branch.padEnd(14)} ${String(b.cases).padStart(3)} cases  ${b.display.logged}  conv ${b.conversion_pct}%`);

  console.log(`\n=== funnel ===`);
  for (const f of (await funnel(prisma, sid, {})).data) console.log(`  ${f.stage.padEnd(20)} ${String(f.cases).padStart(3)}  ${f.display.logged}`);

  console.log(`\n=== agent_leaderboard (top 3) ===`);
  for (const a of (await agentLeaderboard(prisma, sid, {})).data.slice(0, 3)) console.log(`  ${a.agentName.padEnd(18)} ${String(a.cases).padStart(2)} cases  ${a.display.logged}`);

  const sc = await stuckCases(prisma, sid, {});
  console.log(`\n=== stuck_cases === ${sc.data.length} cases; top:`);
  for (const c of sc.data.slice(0, 3)) console.log(`  ${c.customerName.padEnd(22)} ${c.display.loggedFull.padStart(12)}  ${c.leadStatus}`);

  console.log(`\n=== stuck_summary ===`);
  for (const s of (await stuckSummary(prisma, sid, {})).data) console.log(`  ${s.leadStatus.padEnd(26)} ${String(s.count).padStart(2)}  ${s.display.premium}`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
