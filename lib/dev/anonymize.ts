// §11 anonymizer — pseudonymize customer / agent / AM names + customer IDs so a demo can run
// without exposing real people. Deterministic + referential-integrity-preserving: the same real
// name always maps to the same pseudonym, so all aggregates (counts, premiums) are unchanged.
import Papa from "papaparse";
import { stripBom } from "../ingest/normalize";

function makePseudonymizer(prefix: string) {
  const map = new Map<string, string>();
  return (raw: string | undefined): string => {
    const v = (raw ?? "").trim();
    // Preserve blanks and the unassigned sentinel so funnel/leaderboard buckets stay intact.
    if (v === "" || v === "." || v.replace(/\./g, "").toUpperCase() === "NONE") return raw ?? "";
    if (!map.has(v)) map.set(v, `${prefix} ${String(map.size + 1).padStart(3, "0")}`);
    return map.get(v)!;
  };
}

/** Replace PII name/ID columns with stable pseudonyms; leave everything else untouched. */
export function anonymizeCsv(csv: string): string {
  const parsed = Papa.parse<Record<string, string>>(stripBom(csv), { header: true, skipEmptyLines: "greedy" });
  const fields = parsed.meta.fields ?? [];
  const cust = makePseudonymizer("Customer");
  const agent = makePseudonymizer("Agent");
  const am = makePseudonymizer("Manager");
  const cid = makePseudonymizer("CUST");

  for (const row of parsed.data) {
    if ("Full Name" in row) row["Full Name"] = cust(row["Full Name"]);
    if ("First Name" in row) row["First Name"] = row["Full Name"] ?? "";
    if ("Last Name" in row) row["Last Name"] = "";
    if ("Agent Name" in row) row["Agent Name"] = agent(row["Agent Name"]);
    if ("Agency Manager Name" in row) row["Agency Manager Name"] = am(row["Agency Manager Name"]);
    if ("Customer ID" in row) row["Customer ID"] = cid(row["Customer ID"]);
  }
  return Papa.unparse(parsed.data, { columns: fields, newline: "\r\n" });
}

export const DEMO_TENANT_ID = "00000000-0000-0000-0000-0000000000de";
export const ANON_FILENAME = "nb_sample_anon.csv";
