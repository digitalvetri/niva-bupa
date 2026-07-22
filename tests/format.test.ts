import { describe, it, expect } from "vitest";
import { formatINR, formatINRFull, formatPct } from "../lib/metrics/format.js";

describe("§6.3 formatINR (compact)", () => {
  it("lakh form", () => {
    expect(formatINR(3177434)).toBe("₹31.77L");
    expect(formatINR(1629060)).toBe("₹16.29L");
    expect(formatINR(857759)).toBe("₹8.58L");
    expect(formatINR(297314)).toBe("₹2.97L");
    expect(formatINR(145951)).toBe("₹1.46L");
  });
  it("crore form", () => {
    expect(formatINR(12300000)).toBe("₹1.23Cr");
  });
  it("below a lakh -> full Indian grouping", () => {
    expect(formatINR(30062)).toBe("₹30,062");
    expect(formatINR(0)).toBe("₹0");
  });
});

describe("§6.3 formatINRFull (Indian grouping)", () => {
  it.each([
    [145951, "₹1,45,951"],
    [30062, "₹30,062"],
    [3177434, "₹31,77,434"],
    [500, "₹500"],
    [1000000, "₹10,00,000"],
  ])("%i -> %s", (n, out) => {
    expect(formatINRFull(n)).toBe(out);
  });
});

describe("§6.3 percentages (1 decimal)", () => {
  it("computes and rounds", () => {
    expect(formatPct(50, 80)).toBe(62.5);
    expect(formatPct(50, 81)).toBe(61.7);
    expect(formatPct(0, 0)).toBe(0);
  });
});
