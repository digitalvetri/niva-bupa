// Coding module ingestion — parses the "Mission 300" workbook (xlsx). One upload = one immutable
// CodingSnapshot. Leads come from the responses/lead sheet; mission + per-TH + per-branch targets
// come from the Dashboard / TH Dashboard / Branch Dashboard sheets. Robust to column order via
// header-keyword matching.
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";

export type CodingIngestInput = { tenantId: string; uploadedById: string; fileName: string; buffer: Buffer };
export type CodingIngestResult = { snapshotId: string; status: "READY" | "FAILED"; rowCount: number; durationMs: number; error?: string; added?: number; updated?: number; mergedFrom?: number };

// A lead in flight before it gets a snapshot/tenant/row-id (used for the auto-merge).
type ParsedLead = {
  leadId: string | null; date: Date | null; th: string; branch: string; bdm: string | null; agentName: string;
  mobile: string | null; competitor: string | null; city: string | null; experience: string | null; source: string | null; status: string; remarks: string | null; raw: unknown;
};

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const normHeader = (h: unknown) => String(h ?? "").toLowerCase().replace(/[0-9.]/g, "").replace(/\s+/g, " ").trim();

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return isNaN(d.getTime()) ? null : d;
}
function toDate(v: unknown): Date | null {
  if (typeof v === "number") return excelSerialToDate(v);
  if (v instanceof Date) return v;
  if (typeof v === "string" && v.trim()) { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  return null;
}
function normStatus(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (s.startsWith("verif")) return "VERIFIED";
  if (s.startsWith("dupl")) return "DUPLICATE";
  if (s.startsWith("invalid")) return "INVALID";
  return "IDENTIFIED";
}
const str = (v: unknown) => (v == null ? null : String(v).replace(/\s+/g, " ").trim() || null);
const digits = (v: unknown) => (v == null ? null : String(v).replace(/[^\d]/g, "") || null);

type Rows = unknown[][];
const sheetRows = (wb: XLSX.WorkBook, name: string): Rows =>
  wb.Sheets[name] ? (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, blankrows: false }) as Rows) : [];

function findCol(headers: string[], ...keys: string[]): number {
  for (const k of keys) {
    const i = headers.findIndex((h) => h === k || h.includes(k));
    if (i >= 0) return i;
  }
  return -1;
}

/** Pick the sheet that holds the lead rows (most data rows among the known candidates). */
function pickLeadSheet(wb: XLSX.WorkBook): { name: string; rows: Rows } | null {
  const candidates = ["Lead Database", "Form Responses 1", ...wb.SheetNames];
  let best: { name: string; rows: Rows } | null = null;
  for (const name of [...new Set(candidates)]) {
    const rows = sheetRows(wb, name);
    if (rows.length < 2) continue;
    const headers = rows[0]!.map(normHeader);
    const looksLikeLeads = headers.some((h) => h.includes("agent")) && headers.some((h) => h.includes("competitor") || h.includes("branch"));
    if (!looksLikeLeads) continue;
    const dataRows = rows.length - 1;
    if (!best || dataRows > best.rows.length - 1) best = { name, rows };
  }
  return best;
}

function parseTargets(wb: XLSX.WorkBook): { mission: number; byTh: Record<string, number>; byBranch: Record<string, { target: number; bm: string | null; th: string | null }> } {
  const byTh: Record<string, number> = {};
  const byBranch: Record<string, { target: number; bm: string | null; th: string | null }> = {};
  let mission = 300;

  const th = sheetRows(wb, "TH Dashboard");
  for (const r of th.slice(1)) {
    const name = str(r?.[0]);
    const target = Number(r?.[1]);
    if (name && Number.isFinite(target) && target > 0 && name.toLowerCase() !== "th") byTh[name] = Math.round(target);
  }

  const br = sheetRows(wb, "Branch Dashboard");
  for (const r of br.slice(1)) {
    const branch = str(r?.[0]);
    const bm = str(r?.[1]);
    const thName = str(r?.[2]);
    const target = Number(r?.[3]);
    if (branch && branch.toLowerCase() !== "branch" && Number.isFinite(target) && target > 0) {
      byBranch[branch] = { target: Math.round(target), bm, th: thName };
    }
  }

  // Mission target from the Dashboard sheet ("Mission Target" → 300)
  for (const r of sheetRows(wb, "Dashboard")) {
    const cell = String(r?.[0] ?? "").toLowerCase();
    if (cell.includes("mission target") && Number.isFinite(Number(r?.[1]))) { mission = Math.round(Number(r?.[1])); break; }
  }
  return { mission, byTh, byBranch };
}

export async function ingestCodingXlsx(prisma: PrismaClient, input: CodingIngestInput): Promise<CodingIngestResult> {
  const started = Date.now();
  const now = () => Date.now() - started;
  const hash = sha256(input.buffer);

  const existing = await prisma.codingSnapshot.findFirst({ where: { tenantId: input.tenantId, fileHash: hash } });
  if (existing) {
    return { snapshotId: existing.id, status: existing.status === "FAILED" ? "FAILED" : "READY", rowCount: existing.rowCount, durationMs: now(), error: `Already uploaded on ${existing.createdAt.toISOString().slice(0, 10)}` };
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(input.buffer, { type: "buffer", cellDates: false });
  } catch {
    const snap = await prisma.codingSnapshot.create({ data: { tenantId: input.tenantId, fileName: input.fileName, fileHash: hash, rowCount: 0, status: "FAILED", uploadedById: input.uploadedById } });
    return { snapshotId: snap.id, status: "FAILED", rowCount: 0, durationMs: now(), error: "Could not read the Excel file" };
  }

  const picked = pickLeadSheet(wb);
  const targets = parseTargets(wb);
  const snap = await prisma.codingSnapshot.create({
    data: { tenantId: input.tenantId, fileName: input.fileName, fileHash: hash, rowCount: 0, status: "PROCESSING", uploadedById: input.uploadedById, missionTarget: targets.mission, targets: { byTh: targets.byTh, byBranch: targets.byBranch } as object },
  });

  if (!picked) {
    await prisma.codingSnapshot.update({ where: { id: snap.id }, data: { status: "FAILED" } });
    return { snapshotId: snap.id, status: "FAILED", rowCount: 0, durationMs: now(), error: "No lead/agent sheet found in the workbook" };
  }

  const headers = picked.rows[0]!.map(normHeader);
  const c = {
    date: findCol(headers, "date"),
    th: findCol(headers, "territory head", "th"),
    branch: findCol(headers, "branch"),
    bdm: findCol(headers, "bdm"),
    agent: findCol(headers, "agent"),
    mobile: findCol(headers, "mobile", "phone"),
    competitor: findCol(headers, "competitor", "company"),
    city: findCol(headers, "city"),
    experience: findCol(headers, "experience"),
    source: findCol(headers, "source"),
    status: findCol(headers, "status"),
    remarks: findCol(headers, "remark"),
    leadId: findCol(headers, "lead id"),
  };
  const at = (row: unknown[], i: number) => (i >= 0 ? row[i] : null);

  // ── Build incoming leads from the new file (skip fully-blank rows) ──
  const dataRows = picked.rows.slice(1).filter((r) => r && r.some((v) => v != null && String(v).trim() !== ""));
  const incoming: ParsedLead[] = dataRows.map((r) => ({
    leadId: str(at(r, c.leadId)),
    date: toDate(at(r, c.date)),
    th: str(at(r, c.th)) ?? "UNKNOWN",
    branch: str(at(r, c.branch)) ?? "UNKNOWN",
    bdm: str(at(r, c.bdm)),
    agentName: str(at(r, c.agent)) ?? "UNKNOWN",
    mobile: digits(at(r, c.mobile)),
    competitor: str(at(r, c.competitor)),
    city: str(at(r, c.city)),
    experience: str(at(r, c.experience)),
    source: str(at(r, c.source)),
    status: at(r, c.status) != null ? normStatus(at(r, c.status)) : "IDENTIFIED",
    remarks: str(at(r, c.remarks)),
    raw: r,
  }));

  // ── Auto-merge into the previous master (latest READY snapshot), deduped by mobile ──
  const prev = await prisma.codingSnapshot.findFirst({ where: { tenantId: input.tenantId, status: "READY" }, orderBy: { createdAt: "desc" }, select: { id: true } });
  const prevLeads = prev ? await prisma.codingLead.findMany({ where: { snapshotId: prev.id } }) : [];
  const prevParsed: ParsedLead[] = prevLeads.map((p) => ({ leadId: p.leadId, date: p.date, th: p.th, branch: p.branch, bdm: p.bdm, agentName: p.agentName, mobile: p.mobile, competitor: p.competitor, city: p.city, experience: p.experience, source: p.source, status: p.status, remarks: p.remarks, raw: p.raw }));

  const mergeKey = (l: ParsedLead) => (l.mobile ? `m:${l.mobile}` : `n:${l.agentName.toLowerCase().trim()}|${l.branch.toLowerCase().trim()}`);
  const DECIDED = new Set(["VERIFIED", "DUPLICATE", "INVALID"]);
  const map = new Map<string, ParsedLead>();
  for (const p of prevParsed) map.set(mergeKey(p), p);

  let added = 0, updated = 0;
  for (const inc of incoming) {
    const k = mergeKey(inc);
    const cur = map.get(k);
    if (cur) {
      // Update with the latest info, but keep a manually-decided status and the stable lead ID.
      map.set(k, {
        ...cur,
        date: inc.date ?? cur.date,
        th: inc.th, branch: inc.branch, bdm: inc.bdm ?? cur.bdm, agentName: inc.agentName,
        competitor: inc.competitor ?? cur.competitor, city: inc.city ?? cur.city, experience: inc.experience ?? cur.experience,
        source: inc.source ?? cur.source, remarks: inc.remarks ?? cur.remarks,
        status: DECIDED.has(cur.status) ? cur.status : inc.status !== "IDENTIFIED" ? inc.status : cur.status,
      });
      updated++;
    } else {
      map.set(k, inc);
      added++;
    }
  }
  const merged = [...map.values()];

  // Stable lead IDs: keep existing NB#####; number brand-new leads continuing from the max.
  let maxNum = 0;
  for (const l of merged) { const m = l.leadId?.match(/(\d+)/); if (m) maxNum = Math.max(maxNum, parseInt(m[1]!, 10)); }
  for (const l of merged) { if (!l.leadId) l.leadId = `NB${String(++maxNum).padStart(5, "0")}`; }

  const finalRows = merged.map((l) => ({
    snapshotId: snap.id, tenantId: input.tenantId, leadId: l.leadId!, date: l.date, th: l.th, branch: l.branch, bdm: l.bdm,
    agentName: l.agentName, mobile: l.mobile, competitor: l.competitor, city: l.city, experience: l.experience, source: l.source,
    status: l.status, remarks: l.remarks, isDuplicate: l.status === "DUPLICATE", raw: (l.raw ?? {}) as object,
  }));

  const BATCH = 500;
  for (let i = 0; i < finalRows.length; i += BATCH) await prisma.codingLead.createMany({ data: finalRows.slice(i, i + BATCH) });
  await prisma.codingSnapshot.update({ where: { id: snap.id }, data: { rowCount: finalRows.length, status: "READY" } });

  return { snapshotId: snap.id, status: "READY", rowCount: finalRows.length, durationMs: now(), added, updated, mergedFrom: prevLeads.length };
}
