type Bucket = { count: number; windowStart: number };

const ipBuckets = new Map<string, Bucket>();
const batchBuckets = new Map<string, Bucket>();

const IP_WINDOW_MS = 60_000;
const IP_MAX_PER_WINDOW = 120;
const BATCH_WINDOW_MS = 60_000;
const BATCH_MAX_PER_WINDOW = 8;

function touch(buckets: Map<string, Bucket>, key: string, windowMs: number, max: number) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.windowStart > windowMs) {
    b = { count: 0, windowStart: now };
    buckets.set(key, b);
  }
  if (b.count >= max) {
    return { ok: false as const, retryAfterSec: Math.ceil((windowMs - (now - b.windowStart)) / 1000) };
  }
  b.count += 1;
  return { ok: true as const };
}

/** Limit abusive auto-enqueue from the public menu API. */
export function autoEnqueueRateLimitCheck(
  ip: string,
  restaurantId: string,
  orderId: string,
  batchId: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const ipRl = touch(ipBuckets, ip || 'unknown', IP_WINDOW_MS, IP_MAX_PER_WINDOW);
  if (!ipRl.ok) return ipRl;
  return touch(
    batchBuckets,
    `${restaurantId}:${orderId}:${batchId}`,
    BATCH_WINDOW_MS,
    BATCH_MAX_PER_WINDOW,
  );
}
