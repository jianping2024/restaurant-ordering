import { checkInMemoryRateLimit } from '@/lib/in-memory-rate-limit';

const getBuckets = new Map<string, { count: number; windowStart: number }>();
const patchBuckets = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = 60_000;
const GET_MAX_PER_WINDOW = 30;
const PATCH_MAX_PER_WINDOW = 60;

export function abnormalOperationsListRateLimitCheck(ownerId: string, restaurantId: string) {
  return checkInMemoryRateLimit(
    getBuckets,
    `abnormal-get:${ownerId}:${restaurantId}`,
    GET_MAX_PER_WINDOW,
    WINDOW_MS,
  );
}

export function abnormalOperationsPatchRateLimitCheck(ownerId: string, restaurantId: string) {
  return checkInMemoryRateLimit(
    patchBuckets,
    `abnormal-patch:${ownerId}:${restaurantId}`,
    PATCH_MAX_PER_WINDOW,
    WINDOW_MS,
  );
}
