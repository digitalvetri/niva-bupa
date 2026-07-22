// CLI: write an anonymized copy of the fixture (fixtures/nb_sample_anon.csv) — no real names.
import { readFileSync, writeFileSync } from "node:fs";
import { anonymizeCsv, ANON_FILENAME } from "../lib/dev/anonymize";

const src = readFileSync("fixtures/nb_sample.csv", "utf8");
const out = `fixtures/${ANON_FILENAME}`;
writeFileSync(out, anonymizeCsv(src));
console.log(`anonymized fixture written to ${out}`);
