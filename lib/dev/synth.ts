// Generate a plausible "previous week" snapshot from the fixture for compare testing.
// TEST DATA ONLY — clearly marked, deterministic (no RNG), never used in a production seed.
import Papa from "papaparse";
import { stripBom } from "../ingest/normalize";

/**
 * Transform an NB CSV into a "previous week" variant with plausible variance:
 * - premiums scaled down deterministically (so the current week shows improvement),
 * - a few issued cases pushed back to "under processing" (last week fewer were issued).
 */
export function synthPrevWeekCsv(originalCsv: string): string {
  const parsed = Papa.parse<Record<string, string>>(stripBom(originalCsv), { header: true, skipEmptyLines: "greedy" });
  const rows = parsed.data;
  const fields = parsed.meta.fields ?? [];

  rows.forEach((row, i) => {
    // Deterministic factor in [0.75, 1.04] from the row index.
    const factor = 0.75 + ((i * 37) % 30) / 100;
    const scale = (col: string) => {
      const n = Number((row[col] ?? "").replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) row[col] = String(Math.round(n * factor));
    };
    scale("Logged Premium");
    scale("Issued Premium");
    // Every 9th issued case was still "under processing" a week ago.
    if (i % 9 === 0 && (row["Sales Status"] ?? "").trim() === "Policy issued") {
      row["Sales Status"] = "Under processing with underwriting";
      row["Policy Number"] = "";
      row["Issued Premium"] = "0";
    }
  });

  return Papa.unparse(rows, { columns: fields, newline: "\r\n" });
}

export const SYNTH_PREV_FILENAME = "nb_sample_prevweek_SYNTHETIC.csv";
