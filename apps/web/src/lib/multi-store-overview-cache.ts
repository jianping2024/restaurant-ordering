import type { DashboardTodayKpis } from '@/lib/dashboard-overview';

/** KPI numbers only — never authorization (that runs on every request). */
export type MultiStoreKpiSnapshot = {
  todayDateKey: string;
  generatedAt: string;
  kpisByRestaurantId: Record<string, DashboardTodayKpis>;
};

export const MULTI_STORE_OVERVIEW_CACHE_TTL_MS = 30_000;
const MAX_ENTRIES = 200;

type Entry = { expiresAt: number; value: Promise<MultiStoreKpiSnapshot> };
const entries = new Map<string, Entry>();

/** Cache key: Lisbon day + sorted id set (same stores, same day → same numbers). */
export function multiStoreKpiCacheKey(ids: readonly string[], todayDateKey: string): string {
  return `${todayDateKey}|${[...ids].sort().join(',')}`;
}

/**
 * Per-instance ~30 s cache (in-flight loads shared). A failed load is dropped so the next
 * request retries.
 */
export function readMultiStoreKpiCache(
  ids: readonly string[],
  todayDateKey: string,
  nowMs: number,
  load: () => Promise<MultiStoreKpiSnapshot>,
): Promise<MultiStoreKpiSnapshot> {
  const key = multiStoreKpiCacheKey(ids, todayDateKey);
  const hit = entries.get(key);
  if (hit && hit.expiresAt > nowMs) return hit.value;

  for (const [k, e] of Array.from(entries)) if (e.expiresAt <= nowMs) entries.delete(k);
  while (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }

  const value = load();
  entries.set(key, { expiresAt: nowMs + MULTI_STORE_OVERVIEW_CACHE_TTL_MS, value });
  value.catch(() => {
    if (entries.get(key)?.value === value) entries.delete(key);
  });
  return value;
}

/** Tests only. */
export function clearMultiStoreKpiCache(): void {
  entries.clear();
}
