type Bucket = { count: number; windowStart: number; consecutiveFailures: number; blockedUntil: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_FAILURES_PER_WINDOW = 20;
const FAIL_THRESHOLD = 8;
const BLOCK_MS = 5 * 60_000;

function bucket(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = { count: 0, windowStart: Date.now(), consecutiveFailures: 0, blockedUntil: 0 };
    buckets.set(key, b);
  }
  return b;
}

function keys(email: string, ip: string): string[] {
  const normalized = email.trim().toLowerCase();
  const safeIp = ip || 'unknown';
  return [`login-email:${normalized}`, `login-ip:${safeIp}:${normalized}`];
}

function evaluate(key: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const b = bucket(key);
  const now = Date.now();
  if (b.blockedUntil > now) {
    return { ok: false, retryAfterSec: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  if (now - b.windowStart > WINDOW_MS) {
    b.windowStart = now;
    b.count = 0;
  }
  if (b.count >= MAX_FAILURES_PER_WINDOW) {
    return { ok: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - b.windowStart)) / 1000) };
  }
  return { ok: true };
}

function worstRetry(
  results: Array<{ ok: true } | { ok: false; retryAfterSec: number }>,
): { ok: false; retryAfterSec: number } | null {
  let max = 0;
  for (const r of results) {
    if (!r.ok) max = Math.max(max, r.retryAfterSec);
  }
  return max > 0 ? { ok: false, retryAfterSec: max } : null;
}

export function authLoginRateLimitCheck(
  email: string,
  ip: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const blocked = worstRetry(keys(email, ip).map(evaluate));
  if (blocked) return blocked;
  return { ok: true };
}

/** Wrong password / invalid staff only — not server or DB errors. */
export function authLoginRecordFailure(email: string, ip: string): void {
  for (const key of keys(email, ip)) {
    const b = bucket(key);
    const now = Date.now();
    if (now - b.windowStart > WINDOW_MS) {
      b.windowStart = now;
      b.count = 0;
    }
    b.count += 1;
    b.consecutiveFailures += 1;
    if (b.consecutiveFailures >= FAIL_THRESHOLD) {
      b.blockedUntil = Date.now() + BLOCK_MS;
      b.consecutiveFailures = 0;
    }
  }
}

export function authLoginRecordSuccess(email: string, ip: string): void {
  for (const key of keys(email, ip)) {
    const b = bucket(key);
    b.consecutiveFailures = 0;
  }
}
