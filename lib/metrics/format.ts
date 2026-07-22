// §6.3 formatting. formatINR = compact (Cr/L); formatINRFull = full Indian digit grouping.

const CRORE = 1_00_00_000;
const LAKH = 1_00_000;

/** Group an integer string with the Indian system: last 3 digits, then pairs. */
function groupIndian(intPart: string): string {
  const neg = intPart.startsWith("-");
  const digits = neg ? intPart.slice(1) : intPart;
  if (digits.length <= 3) return (neg ? "-" : "") + digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d\d)+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + "," + last3;
}

/** Full grouped rupee value, e.g. 145951 -> "₹1,45,951". Keeps 2 decimals only if non-integer. */
export function formatINRFull(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const isInt = Number.isInteger(rounded);
  const abs = Math.abs(rounded);
  const intPart = Math.trunc(abs).toString();
  const sign = rounded < 0 ? "-" : "";
  const grouped = groupIndian(intPart);
  if (isInt) return `${sign}₹${grouped}`;
  const frac = (abs - Math.trunc(abs)).toFixed(2).slice(2);
  return `${sign}₹${grouped}.${frac}`;
}

/** Compact rupee value: ≥1Cr -> "₹1.23Cr"; ≥1L -> "₹31.77L"; else full grouping. §6.3 */
export function formatINR(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= CRORE) return `${sign}₹${(abs / CRORE).toFixed(2)}Cr`;
  if (abs >= LAKH) return `${sign}₹${(abs / LAKH).toFixed(2)}L`;
  return formatINRFull(n);
}

/** Percentage to 1 decimal (§6.3). Guards divide-by-zero -> 0. */
export function formatPct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}
