type Bucket = { count: number; windowStart: number };

const sessionBuckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
/** Per table session (not shared with orders/append IP buckets). */
const MAX_PER_WINDOW = 60;

function touch(key: string, windowMs: number, max: number) {
  const now = Date.now();
  let b = sessionBuckets.get(key);
  if (!b || now - b.windowStart > windowMs) {
    b = { count: 0, windowStart: now };
    sessionBuckets.set(key, b);
  }
  if (b.count >= max) {
    return { ok: false as const, retryAfterSec: Math.ceil((windowMs - (now - b.windowStart)) / 1000) };
  }
  b.count += 1;
  return { ok: true as const };
}

export function tableOrderRoundRateLimitCheck(sessionId: string) {
  return touch(sessionId || 'unknown', WINDOW_MS, MAX_PER_WINDOW);
}
