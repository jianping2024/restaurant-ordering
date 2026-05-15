import type { StaffRole } from '@/lib/staff-session';

type Bucket = { count: number; windowStart: number; consecutiveFailures: number; blockedUntil: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const FAIL_THRESHOLD = 5;
const BLOCK_MS = 15 * 60_000;

function bucket(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = { count: 0, windowStart: Date.now(), consecutiveFailures: 0, blockedUntil: 0 };
    buckets.set(key, b);
  }
  return b;
}

function keys(slug: string, role: StaffRole, ip: string): string[] {
  const safeIp = ip || 'unknown';
  return [`ip:${slug}:${role}:${safeIp}`, `acct:${slug}:${role}`];
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
  if (b.count >= MAX_PER_WINDOW) {
    return { ok: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - b.windowStart)) / 1000) };
  }
  return { ok: true };
}

function touch(key: string): void {
  bucket(key).count += 1;
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

/** Per IP+slug+role and per slug+role account lockout. */
export function staffSessionRateLimitCheck(
  slug: string,
  role: StaffRole,
  ip: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const ks = keys(slug, role, ip);
  const blocked = worstRetry(ks.map(evaluate));
  if (blocked) return blocked;
  ks.forEach(touch);
  return { ok: true };
}

export function staffSessionRecordFailure(slug: string, role: StaffRole, ip: string): void {
  for (const key of keys(slug, role, ip)) {
    const b = bucket(key);
    b.consecutiveFailures += 1;
    if (b.consecutiveFailures >= FAIL_THRESHOLD) {
      b.blockedUntil = Date.now() + BLOCK_MS;
      b.consecutiveFailures = 0;
    }
  }
}

export function staffSessionRecordSuccess(slug: string, role: StaffRole, ip: string): void {
  for (const key of keys(slug, role, ip)) {
    bucket(key).consecutiveFailures = 0;
  }
}
