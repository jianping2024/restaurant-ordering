type Bucket = { count: number; windowStart: number };

const ipBuckets = new Map<string, Bucket>();
const IP_WINDOW_MS = 60_000;
/** Per public IP (e.g. restaurant guest WiFi NAT). Raised from 60 to reduce opening-rush false positives. */
const IP_MAX_PER_WINDOW = 120;

function touch(key: string, windowMs: number, max: number) {
  const now = Date.now();
  let b = ipBuckets.get(key);
  if (!b || now - b.windowStart > windowMs) {
    b = { count: 0, windowStart: now };
    ipBuckets.set(key, b);
  }
  if (b.count >= max) {
    return { ok: false as const, retryAfterSec: Math.ceil((windowMs - (now - b.windowStart)) / 1000) };
  }
  b.count += 1;
  return { ok: true as const };
}

export function orderAppendRateLimitCheck(ip: string) {
  return touch(ip || 'unknown', IP_WINDOW_MS, IP_MAX_PER_WINDOW);
}
