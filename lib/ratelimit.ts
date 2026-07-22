// In-memory fixed-window rate limiter (§11). Good enough for a single instance; a multi-instance
// deployment must swap this for Redis/Upstash — the interface stays the same.
type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

export type RateResult = { ok: boolean; remaining: number; retryAfterSec: number };

/** Allow `limit` requests per `windowMs` for `key`. Not sliding — resets on the window boundary. */
export function rateLimit(key: string, limit: number, windowMs: number, nowMs = Date.now()): RateResult {
  const w = windows.get(key);
  if (!w || nowMs >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: nowMs + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (w.count >= limit) return { ok: false, remaining: 0, retryAfterSec: Math.ceil((w.resetAt - nowMs) / 1000) };
  w.count += 1;
  return { ok: true, remaining: limit - w.count, retryAfterSec: 0 };
}

/** Test/inspection helper. */
export function resetRateLimits(): void {
  windows.clear();
}
