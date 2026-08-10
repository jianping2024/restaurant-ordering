/**
 * Sole in-memory cache for dashboard historical list pages
 * (operation-logs / abnormal-operations via useDashboardListQuery).
 *
 * Closed calendar ranges (endDate < today): sticky until invalidate.
 * Ranges that include today: short TTL; stale hits revalidate.
 */

export const DASHBOARD_LIST_OPEN_RANGE_MAX_AGE_MS = 30_000;
export const DASHBOARD_LIST_CACHE_MAX_ENTRIES = 40;

export type DashboardListCacheScope = 'operation-logs' | 'abnormal-operations';

type CacheEntry = {
  data: unknown;
  storedAt: number;
};

const store = new Map<string, CacheEntry>();

export function buildDashboardListCacheKey(parts: {
  scope: string;
  restaurantId: string;
  filters: unknown;
  page: number;
  pageSize: number;
}): string {
  return [
    parts.scope,
    parts.restaurantId,
    JSON.stringify(parts.filters),
    String(parts.page),
    String(parts.pageSize),
  ].join('\u0001');
}

/** Lisbon YYYY-MM-DD: closed when the range ends before today. */
export function isDashboardListClosedRange(endDate: string, today: string): boolean {
  return Boolean(endDate && today && endDate < today);
}

export type DashboardListCacheRead<T> =
  | { action: 'miss' }
  | { action: 'fresh'; data: T }
  | { action: 'stale'; data: T };

export function readDashboardListCache<T>(
  key: string,
  options: {
    closed: boolean;
    now?: number;
    openMaxAgeMs?: number;
  },
): DashboardListCacheRead<T> {
  const entry = store.get(key);
  if (!entry) return { action: 'miss' };

  if (options.closed) {
    return { action: 'fresh', data: entry.data as T };
  }

  const now = options.now ?? Date.now();
  const maxAge = options.openMaxAgeMs ?? DASHBOARD_LIST_OPEN_RANGE_MAX_AGE_MS;
  if (now - entry.storedAt <= maxAge) {
    return { action: 'fresh', data: entry.data as T };
  }
  return { action: 'stale', data: entry.data as T };
}

export function writeDashboardListCache(key: string, data: unknown, now = Date.now()): void {
  if (store.has(key)) store.delete(key);
  store.set(key, { data, storedAt: now });
  while (store.size > DASHBOARD_LIST_CACHE_MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/** Drop every entry for a restaurant list surface (e.g. after abnormal PATCH). */
export function invalidateDashboardListCache(scope: string, restaurantId: string): void {
  const prefix = `${scope}\u0001${restaurantId}\u0001`;
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Test / logout helper. */
export function clearDashboardListCache(): void {
  store.clear();
}

export function dashboardListCacheSizeForTests(): number {
  return store.size;
}
