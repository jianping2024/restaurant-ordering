import { checkInMemoryRateLimit } from '@/lib/in-memory-rate-limit';

const buckets = new Map<string, { count: number; windowStart: number }>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

export function analyticsValueOverviewRateLimitCheck(ownerId: string, restaurantId: string) {
  return checkInMemoryRateLimit(
    buckets,
    `analytics-overview:${ownerId}:${restaurantId}`,
    MAX_PER_WINDOW,
    WINDOW_MS,
  );
}
