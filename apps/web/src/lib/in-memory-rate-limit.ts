type Bucket = { count: number; windowStart: number };

export function checkInMemoryRateLimit(
  buckets: Map<string, Bucket>,
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }
  if (bucket.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((windowMs - (now - bucket.windowStart)) / 1000),
    };
  }
  bucket.count += 1;
  return { ok: true };
}
