type Bucket = { count: number; windowStart: number };

const getBuckets = new Map<string, Bucket>();
const patchBuckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const GET_MAX_PER_WINDOW = 30;
const PATCH_MAX_PER_WINDOW = 60;

function touch(
  buckets: Map<string, Bucket>,
  key: string,
  max: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    bucket = { count: 0, windowStart: now };
    buckets.set(key, bucket);
  }
  if (bucket.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000),
    };
  }
  bucket.count += 1;
  return { ok: true };
}

export function abnormalOperationsListRateLimitCheck(ownerId: string, restaurantId: string) {
  return touch(getBuckets, `abnormal-get:${ownerId}:${restaurantId}`, GET_MAX_PER_WINDOW);
}

export function abnormalOperationsPatchRateLimitCheck(ownerId: string, restaurantId: string) {
  return touch(patchBuckets, `abnormal-patch:${ownerId}:${restaurantId}`, PATCH_MAX_PER_WINDOW);
}
