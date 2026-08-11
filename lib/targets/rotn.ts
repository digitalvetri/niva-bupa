// ROTN Territory Targets (FY 2026-27) — GWP + recruitment + activation, by branch × fiscal month.
// Seeded from the FY26-27 target poster; fully editable in the Targets page. The page recomputes
// FY totals from the monthly cells, so it stays internally consistent even where the printed poster
// totals differed slightly.

export const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;
export type Month = (typeof MONTHS)[number];

export const TARGET_BRANCHES = ["Coimbatore", "Hosur", "Erode", "Salem", "Tirunelveli", "Thanjavur", "Tirunelveli 2"] as const;

export type CategoryKey = "GWP" | "AGENT_RECRUITMENT" | "LEADER_RECRUITMENT" | "LEADER_ACTIVATION" | "AGENT_ACTIVATION";
export const CATEGORIES: { key: CategoryKey; label: string; unit: string; isMoney?: boolean; accent: string }[] = [
  { key: "GWP", label: "GWP Target", unit: "₹ Lakhs", isMoney: true, accent: "#1e3a8a" },
  { key: "AGENT_RECRUITMENT", label: "Agent Recruitment", unit: "agents", accent: "#15803d" },
  { key: "LEADER_RECRUITMENT", label: "Leader Recruitment", unit: "leaders", accent: "#ea580c" },
  { key: "LEADER_ACTIVATION", label: "Leader Activation", unit: "leaders", accent: "#7c3aed" },
  { key: "AGENT_ACTIVATION", label: "Agent Activation", unit: "agents", accent: "#0e7490" },
];

// category -> branch -> [Apr..Mar]
export type TargetGrid = Record<string, Record<string, number[]>>;

export type RotnTargets = {
  fiscalYear: string;
  monthsClosed: number; // how many fiscal months (from Apr) have closed → drives YTD targets
  data: TargetGrid;
};

export const DEFAULT_TARGETS: TargetGrid = {
  GWP: {
    Coimbatore: [17.5, 18.2, 19.6, 19.6, 21, 23.8, 21.7, 21, 27.3, 25.9, 25.9, 38.5],
    Hosur: [10, 10.4, 11.2, 11.2, 12, 13.6, 12.4, 12, 15.6, 14.8, 14.8, 22],
    Erode: [10, 10.4, 11.2, 11.2, 12, 13.6, 12.4, 12, 15.6, 14.8, 14.8, 22],
    Salem: [18.75, 19.5, 21, 21, 22.5, 25.5, 23.25, 22.5, 29.25, 27.75, 27.75, 41.25],
    Tirunelveli: [10, 10.4, 11.2, 11.2, 12, 13.6, 12.4, 12, 15.6, 14.8, 14.8, 22],
    Thanjavur: [9.38, 9.75, 10.5, 10.5, 11.25, 12.75, 11.63, 11.25, 14.63, 13.88, 13.88, 20.63],
    "Tirunelveli 2": [6.25, 6.5, 7, 7, 7.5, 8.5, 7.75, 7.5, 9.75, 9.25, 9.25, 13.75],
  },
  AGENT_RECRUITMENT: {
    Coimbatore: [13, 14, 14, 15, 14, 15, 12, 13, 13, 10, 8, 9],
    Hosur: [6, 7, 7, 7, 7, 7, 6, 6, 6, 5, 4, 4],
    Erode: [10, 10, 11, 11, 11, 11, 9, 9, 9, 7, 6, 7],
    Salem: [10, 10, 11, 11, 11, 11, 9, 9, 9, 7, 6, 7],
    Tirunelveli: [10, 11, 12, 12, 12, 12, 10, 10, 10, 8, 7, 7],
    Thanjavur: [10, 10, 11, 11, 11, 11, 9, 9, 9, 7, 6, 6],
    "Tirunelveli 2": [9, 9, 10, 10, 10, 11, 8, 9, 9, 7, 6, 6],
  },
  LEADER_RECRUITMENT: {
    Coimbatore: [4, 4, 4, 4, 4, 4, 3, 3, 3, 2, 2, 2],
    Hosur: [2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1],
    Erode: [3, 3, 3, 3, 3, 3, 2, 3, 3, 2, 2, 2],
    Salem: [3, 3, 3, 3, 3, 3, 2, 3, 3, 2, 2, 2],
    Tirunelveli: [2, 2, 2, 2, 2, 1, 1, 2, 2, 1, 1, 1],
    Thanjavur: [3, 3, 3, 3, 3, 3, 2, 3, 3, 2, 2, 2],
    "Tirunelveli 2": [2, 2, 2, 2, 2, 2, 1, 2, 2, 1, 1, 1],
  },
  LEADER_ACTIVATION: {
    Coimbatore: [14, 14, 15, 15, 16, 18, 17, 16, 21, 20, 20, 30],
    Hosur: [8, 8, 9, 9, 9, 11, 10, 9, 12, 11, 11, 17],
    Erode: [8, 8, 9, 9, 9, 11, 10, 9, 12, 11, 11, 17],
    Salem: [15, 15, 16, 16, 17, 20, 18, 17, 23, 21, 21, 32],
    Tirunelveli: [6, 6, 6, 6, 7, 8, 7, 7, 9, 8, 8, 13],
    Thanjavur: [7, 7, 8, 8, 9, 10, 9, 9, 11, 11, 11, 16],
    "Tirunelveli 2": [3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 7],
  },
  AGENT_ACTIVATION: {
    Coimbatore: [34, 35, 38, 38, 40, 46, 42, 40, 52, 50, 50, 74],
    Hosur: [19, 20, 22, 22, 23, 26, 24, 23, 30, 28, 28, 42],
    Erode: [19, 20, 22, 22, 23, 26, 24, 23, 30, 28, 28, 42],
    Salem: [36, 38, 40, 40, 43, 49, 45, 43, 56, 53, 53, 79],
    Tirunelveli: [22, 23, 25, 25, 26, 30, 27, 26, 34, 32, 32, 48],
    Thanjavur: [18, 19, 20, 20, 22, 24, 22, 22, 28, 27, 27, 40],
    "Tirunelveli 2": [9, 10, 11, 11, 11, 13, 12, 11, 15, 14, 14, 21],
  },
};

/** Fiscal-month number for today (Apr = 1 … Mar = 12). */
export function currentFiscalMonth(): number {
  return ((new Date().getMonth() - 3 + 12) % 12) + 1;
}

export function defaultRotnTargets(): RotnTargets {
  // Deep clone so edits don't mutate the module default.
  const data: TargetGrid = {};
  for (const [cat, branches] of Object.entries(DEFAULT_TARGETS)) {
    data[cat] = {};
    for (const [b, arr] of Object.entries(branches)) data[cat][b] = [...arr];
  }
  // monthsClosed doubles as the CURRENT fiscal month (1=Apr … 12=Mar); the target is that month's cell.
  return { fiscalYear: "2026-27", monthsClosed: currentFiscalMonth(), data };
}

const sum = (a: number[]) => a.reduce((x, y) => x + (Number(y) || 0), 0);

export function fyTotal(t: RotnTargets, cat: string, branch: string): number {
  return sum(t.data[cat]?.[branch] ?? []);
}
export function ytdTarget(t: RotnTargets, cat: string, branch: string): number {
  return sum((t.data[cat]?.[branch] ?? []).slice(0, Math.max(0, Math.min(12, t.monthsClosed))));
}
export function territoryFy(t: RotnTargets, cat: string): number {
  return TARGET_BRANCHES.reduce((s, b) => s + fyTotal(t, cat, b), 0);
}
export function territoryYtd(t: RotnTargets, cat: string): number {
  return TARGET_BRANCHES.reduce((s, b) => s + ytdTarget(t, cat, b), 0);
}

/** Parse the stored settings blob back into RotnTargets (null if absent/invalid). */
export function readRotn(input: unknown): RotnTargets | null {
  if (!input || typeof input !== "object") return null;
  const t = input as Partial<RotnTargets>;
  if (!t.data || typeof t.data !== "object") return null;
  return { fiscalYear: typeof t.fiscalYear === "string" ? t.fiscalYear : "2026-27", monthsClosed: Number(t.monthsClosed) || 0, data: t.data };
}

/** 0-based index of the current month (from monthsClosed = current fiscal month), or -1 if unset. */
export function currentMonthIndex(t: RotnTargets): number {
  return t.monthsClosed >= 1 ? Math.min(11, t.monthsClosed - 1) : -1;
}
export function currentMonthLabel(t: RotnTargets): string {
  const i = currentMonthIndex(t);
  return i >= 0 ? MONTHS[i]! : "—";
}
export function monthTarget(t: RotnTargets, cat: string, branch: string, idx: number): number {
  return t.data[cat]?.[branch]?.[idx] ?? 0;
}

/** THIS MONTH's territory + per-branch target for a category — the target resets each month. */
export function effectiveTargets(t: RotnTargets, cat: string): { territory: number; byBranch: Record<string, number> } {
  const idx = currentMonthIndex(t);
  const byBranch: Record<string, number> = {};
  if (idx < 0) return { territory: 0, byBranch };
  for (const b of TARGET_BRANCHES) byBranch[b] = monthTarget(t, cat, b, idx);
  return { territory: TARGET_BRANCHES.reduce((s, b) => s + byBranch[b]!, 0), byBranch };
}
