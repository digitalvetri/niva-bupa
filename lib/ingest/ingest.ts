// §4 ingestion pipeline. One path for both dashboard and bot. Fails loudly.

import { createHash } from "node:crypto";
import Papa from "papaparse";
import type { PrismaClient } from "@prisma/client";
import { stripBom } from "./normalize.js";
import { parseRow, type RawRow, type IssueDraft, type ParsedCase } from "./parseRow.js";

// Expected NB header columns for the fingerprint check (§4 step 5). A representative subset.
const EXPECTED_HEADERS = [
  "Full Name", "Application Number", "Policy Number", "Customer ID", "Plan Type",
  "Product Genre", "Insured Lives", "Logged Premium", "Issued Premium", "Loading Premium",
  "Sum Assured", "Login Branch", "Sales Branch", "Channel", "Agent Code", "Agent Name",
  "Agency Manager ID", "Agency Manager Name", "Logged Date", "Issued Date", "Maximus Status",
  "Lead Status", "Sales Status", "Discrepancy Status", "Current Status Ageing", "Login Ageing",
  "Policy Start Date", "Policy End Date", "Is Portability", "TENURE",
];
const FINGERPRINT_MIN_RATIO = 0.9;

export type IngestResult = {
  snapshotId: string;
  status: "READY" | "FAILED";
  rowCount: number;
  issueCount: number;
  durationMs: number;
  error?: string;
};

export type IngestInput = {
  tenantId: string;
  uploadedById: string;
  fileName: string;
  content: string; // raw CSV text
};

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** True when ≥90% of expected NB headers are present (§4 step 5). */
export function fingerprintOk(headers: string[]): { ok: boolean; matched: number; expected: number } {
  const present = new Set(headers.map((h) => stripBom(h).trim()));
  const matched = EXPECTED_HEADERS.filter((h) => present.has(h)).length;
  return { ok: matched / EXPECTED_HEADERS.length >= FINGERPRINT_MIN_RATIO, matched, expected: EXPECTED_HEADERS.length };
}

export async function ingestCsv(prisma: PrismaClient, input: IngestInput): Promise<IngestResult> {
  const startedAt = Date.now();
  const now = () => Date.now() - startedAt;
  const hash = sha256(input.content);

  // Step 2: dedupe by (tenantId, hash).
  const existing = await prisma.reportSnapshot.findFirst({ where: { tenantId: input.tenantId, fileHash: hash } });
  if (existing) {
    return {
      snapshotId: existing.id,
      status: existing.status === "FAILED" ? "FAILED" : "READY",
      rowCount: existing.rowCount,
      issueCount: await prisma.ingestionIssue.count({ where: { snapshotId: existing.id } }),
      durationMs: now(),
      error: `Already uploaded on ${existing.createdAt.toISOString().slice(0, 10)}`,
    };
  }

  // Step 3: create PROCESSING snapshot.
  const snapshot = await prisma.reportSnapshot.create({
    data: {
      tenantId: input.tenantId,
      fileName: input.fileName,
      fileHash: hash,
      rowCount: 0,
      status: "PROCESSING",
      uploadedById: input.uploadedById,
    },
  });

  const fail = async (message: string): Promise<IngestResult> => {
    await prisma.ingestionIssue.create({ data: { snapshotId: snapshot.id, severity: "error", message } });
    await prisma.reportSnapshot.update({ where: { id: snapshot.id }, data: { status: "FAILED" } });
    return { snapshotId: snapshot.id, status: "FAILED", rowCount: 0, issueCount: 1, durationMs: now(), error: message };
  };

  // Step 4: parse. skipEmptyLines greedy drops whitespace-only lines.
  const parsed = Papa.parse<RawRow>(stripBom(input.content), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => stripBom(h).trim(),
  });
  const headers = parsed.meta.fields ?? [];

  // Step 5: fingerprint.
  const fp = fingerprintOk(headers);
  if (!fp.ok) {
    return fail(`Unrecognized report format: only ${fp.matched}/${fp.expected} expected NB columns present`);
  }

  // Step 6: normalize + map each row.
  const issues: IssueDraft[] = [];
  const parsedCases: ParsedCase[] = [];
  parsed.data.forEach((row, i) => {
    const res = parseRow(row, i + 1);
    if (res.skip) {
      issues.push(res.issue);
    } else {
      parsedCases.push(res.parsedCase);
      issues.push(...res.issues);
    }
  });

  // Rule §2.3(7): duplicate applicationNo within one file -> keep last, warn.
  const lastIndexByApp = new Map<string, number>();
  parsedCases.forEach((c, idx) => {
    if (c.applicationNo) lastIndexByApp.set(c.applicationNo, idx);
  });
  const keptCases: ParsedCase[] = [];
  parsedCases.forEach((c, idx) => {
    if (c.applicationNo && lastIndexByApp.get(c.applicationNo) !== idx) {
      issues.push({ rowNumber: idx + 1, severity: "warn", message: `Duplicate applicationNo "${c.applicationNo}" — earlier occurrence dropped (kept last)` });
      return;
    }
    keptCases.push(c);
  });

  // Step 7: bulk insert cases in batches of 500.
  const BATCH = 500;
  for (let i = 0; i < keptCases.length; i += BATCH) {
    const batch = keptCases.slice(i, i + BATCH).map((c) => ({
      snapshotId: snapshot.id,
      tenantId: input.tenantId,
      ...c,
      riders: c.riders as object,
      raw: c.raw as object,
    }));
    await prisma.nbCase.createMany({ data: batch });
  }

  // Persist issues.
  if (issues.length > 0) {
    await prisma.ingestionIssue.createMany({
      data: issues.map((iss) => ({
        snapshotId: snapshot.id,
        rowNumber: iss.rowNumber,
        severity: iss.severity,
        message: iss.message,
        rawRow: (iss.rawRow ?? undefined) as object | undefined,
      })),
    });
  }

  // Step 8: compute period + rowCount, mark READY.
  const dates = keptCases.map((c) => c.loggedDate).filter((d): d is Date => d != null);
  const periodStart = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const periodEnd = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  await prisma.reportSnapshot.update({
    where: { id: snapshot.id },
    data: { rowCount: keptCases.length, periodStart, periodEnd, status: "READY" },
  });

  return { snapshotId: snapshot.id, status: "READY", rowCount: keptCases.length, issueCount: issues.length, durationMs: now() };
}
