import { describe, it, expect } from "vitest";
import {
  stripBom, toNull, collapseSpaces, normalizeName, titleCase, upperState,
  normalizePlanType, normalizeChannel, normalizeAgentName, parseMoney,
  parseSumAssured, parseTenure, parseBool, parseIntOrNull, parseUsDate, normalizeRider,
} from "../lib/ingest/normalize.js";
import { mapFunnelStage, bucketFor, isNeedsAction } from "../lib/ingest/funnelStage.js";

describe("§2.3(1) BOM + whitespace", () => {
  it("strips a leading BOM", () => {
    expect(stripBom("﻿First Name")).toBe("First Name");
    expect(stripBom("First Name")).toBe("First Name");
  });
  it("collapses internal double spaces", () => {
    expect(collapseSpaces("NAGARAJAN   P")).toBe("NAGARAJAN P");
  });
});

describe("§2.3(2) N/A -> null", () => {
  it.each(["N/A", "NA", "", "-", " n/a ", "na"])("%s -> null", (v) => {
    expect(toNull(v)).toBeNull();
  });
  it("keeps real values trimmed", () => {
    expect(toNull("  Salem  ")).toBe("Salem");
  });
});

describe("§2.1 name normalization", () => {
  it("collapses spaces and trims trailing ' .'", () => {
    expect(normalizeName("SM  Vijaya  Baskaran .")).toBe("SM Vijaya Baskaran");
    expect(normalizeName("VASUDEVAN .")).toBe("VASUDEVAN");
  });
});

describe("§2.3(3) casing", () => {
  it("branches -> Title Case (ERODE -> Erode)", () => {
    expect(titleCase("ERODE")).toBe("Erode");
    expect(titleCase("salem")).toBe("Salem");
  });
  it("states -> UPPER", () => {
    expect(upperState("Tamil Nadu")).toBe("TAMIL NADU");
    expect(upperState("KARNATAKA")).toBe("KARNATAKA");
  });
  it("plan type mapping", () => {
    expect(normalizePlanType("Family Floater")).toBe("FAMILY_FLOATER");
    expect(normalizePlanType("Family floater")).toBe("FAMILY_FLOATER");
    expect(normalizePlanType("Individual")).toBe("INDIVIDUAL");
    expect(normalizePlanType("Something")).toBe("OTHER");
  });
  it("channel upper", () => {
    expect(normalizeChannel("Agency")).toBe("AGENCY");
    expect(normalizeChannel("AGENCY")).toBe("AGENCY");
  });
});

describe("edge 5 — agent .NONE. -> UNASSIGNED", () => {
  it.each([".NONE.", "NONE", " .none. "])("%s -> UNASSIGNED", (v) => {
    expect(normalizeAgentName(v)).toBe("UNASSIGNED");
  });
  it("real agent kept", () => {
    expect(normalizeAgentName("K SIVAPRAKASH")).toBe("K SIVAPRAKASH");
  });
});

describe("§2.3(4) money", () => {
  it("strips commas", () => {
    expect(parseMoney("1,45,951")).toEqual({ amount: "145951", ok: true });
    expect(parseMoney("30062")).toEqual({ amount: "30062", ok: true });
  });
  it("blank -> 0 ok", () => {
    expect(parseMoney("")).toEqual({ amount: "0", ok: true });
  });
  it("non-numeric -> 0 + not ok (warn)", () => {
    expect(parseMoney("abc")).toEqual({ amount: "0", ok: false });
  });
});

describe("edge 3 — sum assured", () => {
  it("Unlimited -> null + flag", () => {
    expect(parseSumAssured("Unlimited")).toEqual({ numeric: null, isUnlimited: true });
  });
  it("numeric kept", () => {
    expect(parseSumAssured("500000")).toEqual({ numeric: "500000", isUnlimited: false });
  });
});

describe("§2.1 tenure", () => {
  it.each([["1", 1], ["3", 3], ["5", 5], ["Annual", 1], ["3 Yearly", 3], ["5 Yearly", 5]])(
    "%s -> %i", (raw, out) => { expect(parseTenure(raw as string)).toBe(out); },
  );
});

describe("bools + ints", () => {
  it("Yes/No", () => {
    expect(parseBool("Yes")).toBe(true);
    expect(parseBool("No")).toBe(false);
    expect(parseBool("N/A")).toBe(false);
  });
  it("N/A ageing -> null", () => {
    expect(parseIntOrNull("N/A")).toBeNull();
    expect(parseIntOrNull("12")).toBe(12);
  });
});

describe("§2.3(5) M/D/YYYY dates", () => {
  it("parses US style", () => {
    expect(parseUsDate("7/11/2026")?.toISOString().slice(0, 10)).toBe("2026-07-11");
    expect(parseUsDate("12/1/2025")?.toISOString().slice(0, 10)).toBe("2025-12-01");
  });
  it("rejects invalid/overflow -> null", () => {
    expect(parseUsDate("2/30/2026")).toBeNull();
    expect(parseUsDate("N/A")).toBeNull();
    expect(parseUsDate("13/1/2026")).toBeNull();
  });
});

describe("riders normalization", () => {
  it("Y/N/NA mapping", () => {
    expect(normalizeRider("Y")).toBe(true);
    expect(normalizeRider("Yes")).toBe(true);
    expect(normalizeRider("NO")).toBe(false);
    expect(normalizeRider("NA")).toBeNull();
    expect(normalizeRider("")).toBeNull();
    expect(normalizeRider("5000")).toBe("5000");
  });
});

describe("§2.2 funnel stage mapping", () => {
  it.each([
    ["Policy issued", "ISSUED", "Won"],
    ["Under processing with underwriting", "UNDERWRITING", "Pending"],
    ["Under Processing with operations", "OPERATIONS", "Pending"],
    ["Tele underwriting required", "TELE_UW_REQUIRED", "Pending"],
    ["Additional Requirement raised", "REQUIREMENT_RAISED", "Pending"],
    ["Counter Offer Proposed", "COUNTER_OFFER", "Pending"],
    ["Counter Offer Loading", "COUNTER_OFFER", "Pending"],
  ])("%s -> %s (%s)", (raw, stage, bucket) => {
    const r = mapFunnelStage(raw, null);
    expect(r.stage).toBe(stage);
    expect(bucketFor(r.stage)).toBe(bucket);
    expect(r.unmapped).toBe(false);
  });
  it("blank -> UNKNOWN / Review (edge 6)", () => {
    const r = mapFunnelStage("", null);
    expect(r.stage).toBe("UNKNOWN");
    expect(bucketFor(r.stage)).toBe("Review");
  });
  it("unknown value -> OTHER + unmapped warn", () => {
    const r = mapFunnelStage("Some New Status", null);
    expect(r.stage).toBe("OTHER");
    expect(r.unmapped).toBe(true);
  });
  it("needs-action stages flagged red", () => {
    expect(isNeedsAction("TELE_UW_REQUIRED")).toBe(true);
    expect(isNeedsAction("REQUIREMENT_RAISED")).toBe(true);
    expect(isNeedsAction("COUNTER_OFFER")).toBe(true);
    expect(isNeedsAction("ISSUED")).toBe(false);
  });
});
