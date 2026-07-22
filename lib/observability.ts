// Lightweight observability shim (§11 audit). Sentry-pluggable: if SENTRY_DSN is set, forward to
// a Sentry client; otherwise log structured JSON. Tracks a few counters (e.g. ingestion issues).

type Tags = Record<string, string | number | undefined>;

const counters = new Map<string, number>();

/** Capture an error with context. In production, wire a Sentry transport behind SENTRY_DSN. */
export function captureError(error: unknown, tags?: Tags): void {
  const payload = { level: "error", message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, tags };
  // eslint-disable-next-line no-console
  console.error("[observability]", JSON.stringify(payload));
  // if (process.env.SENTRY_DSN) Sentry.captureException(error, { tags });
}

/** Track a numeric metric (monotonic counter). Used e.g. for ingestion issue counts. */
export function trackMetric(name: string, value: number, tags?: Tags): void {
  counters.set(name, (counters.get(name) ?? 0) + value);
  if (process.env.OBSERVABILITY_LOG) {
    // eslint-disable-next-line no-console
    console.log("[metric]", JSON.stringify({ name, value, total: counters.get(name), tags }));
  }
}

/** Read a tracked counter (test/inspection helper). */
export function getMetricTotal(name: string): number {
  return counters.get(name) ?? 0;
}
