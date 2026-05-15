type Bucket = { count: number; windowStart: number; consecutiveFailures: number; blockedUntil: number };

const claimBuckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const FAIL_THRESHOLD = 5;
const BLOCK_MS = 15 * 60_000;

function bucket(key: string): Bucket {
  let b = claimBuckets.get(key);
  if (!b) {
    b = { count: 0, windowStart: Date.now(), consecutiveFailures: 0, blockedUntil: 0 };
    claimBuckets.set(key, b);
  }
  return b;
}

export function claimRateLimitCheck(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const b = bucket(ip);
  const now = Date.now();
  if (b.blockedUntil > now) {
    return { ok: false, retryAfterSec: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  if (now - b.windowStart > WINDOW_MS) {
    b.windowStart = now;
    b.count = 0;
  }
  if (b.count >= MAX_PER_WINDOW) {
    return { ok: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - b.windowStart)) / 1000) };
  }
  b.count += 1;
  return { ok: true };
}

export function claimRecordFailure(ip: string): void {
  const b = bucket(ip);
  b.consecutiveFailures += 1;
  if (b.consecutiveFailures >= FAIL_THRESHOLD) {
    b.blockedUntil = Date.now() + BLOCK_MS;
    b.consecutiveFailures = 0;
  }
}

export function claimRecordSuccess(ip: string): void {
  const b = bucket(ip);
  b.consecutiveFailures = 0;
}
