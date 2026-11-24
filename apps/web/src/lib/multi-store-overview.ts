import 'server-only';

import { isRestaurantSuspended, restaurantCityFromAddress } from '@mesa/shared';
import { resolveTodayLisbonWindow } from '@/lib/analytics/date-window';
import { loadTodayKpisForRestaurants } from '@/lib/dashboard-overview';
import type { AuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';
import {
  listAuthorizedRestaurantIdsWithPermission,
  listAuthorizedRestaurantsForUser,
} from '@/lib/permissions/restaurant-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { readMultiStoreKpiCache, type MultiStoreKpiSnapshot } from '@/lib/multi-store-overview-cache';
import type { MultiStoreOverview, MultiStoreOverviewRow } from '@/lib/multi-store-overview-types';

/**
 * Sole multi-store overview loader (plan §8.4), shared by the page's server render and
 * `GET /api/multi-store/overview`. Authorization runs on every call (never cached); only the
 * KPI computation for the authorized id set is cached ~30 s.
 *
 * Rows: every store where the account holds `dashboard.overview.view` (KPIs from the same
 * {@link loadTodayKpisForRestaurants} as the single-store home), plus the account's suspended
 * stores that staff may not read (flagged, `kpis: null`). `restaurantIds` narrows to a subset;
 * ids outside the account's set are ignored.
 */
export async function loadMultiStoreOverview(
  userId: string,
  options?: { restaurantIds?: readonly string[]; now?: Date },
): Promise<MultiStoreOverview> {
  const now = options?.now ?? new Date();
  const [authorizedIds, listed] = await Promise.all([
    listAuthorizedRestaurantIdsWithPermission(userId, 'dashboard.overview.view'),
    listAuthorizedRestaurantsForUser(userId),
  ]);

  const wanted = options?.restaurantIds ? new Set(options.restaurantIds) : null;
  const inScope = (id: string) => !wanted || wanted.has(id);
  const kpiIds = authorizedIds.filter(inScope);
  const authorizedSet = new Set<string>(authorizedIds);
  const suspendedOnlyIds = listed
    .filter((r) => isRestaurantSuspended(r.suspended_at) && !authorizedSet.has(r.id) && inScope(r.id))
    .map((r) => r.id);
  const rowIds = [...kpiIds, ...suspendedOnlyIds];
  if (rowIds.length === 0) {
    return { todayDateKey: resolveTodayLisbonWindow(now).today, generatedAt: now.toISOString(), rows: [] };
  }

  const admin = createAdminClient();
  const [storesResult, snapshot] = await Promise.all([
    admin.from('restaurants').select('id, slug, name, address, suspended_at').in('id', rowIds),
    loadKpiSnapshot(kpiIds, now),
  ]);
  if (storesResult.error) throw new Error(storesResult.error.message);

  const storeById = new Map(
    (storesResult.data || []).map((row) => [row.id as string, row as StoreRow]),
  );
  const rows: MultiStoreOverviewRow[] = [];
  for (const id of rowIds) {
    const store = storeById.get(id);
    if (!store) continue;
    rows.push({
      restaurantId: id,
      slug: store.slug,
      name: store.name ?? store.slug,
      city: restaurantCityFromAddress(store.address),
      suspended: isRestaurantSuspended(store.suspended_at),
      kpis: snapshot.kpisByRestaurantId[id] ?? null,
    });
  }
  return { todayDateKey: snapshot.todayDateKey, generatedAt: snapshot.generatedAt, rows };
}

type StoreRow = {
  id: string;
  slug: string;
  name: string | null;
  address: string | null;
  suspended_at: string | null;
};

function loadKpiSnapshot(
  ids: readonly AuthorizedRestaurantId[],
  now: Date,
): Promise<MultiStoreKpiSnapshot> {
  const todayDateKey = resolveTodayLisbonWindow(now).today;
  return readMultiStoreKpiCache(ids, todayDateKey, now.getTime(), async () => {
    const { kpisByRestaurantId } = await loadTodayKpisForRestaurants(createAdminClient(), ids, now);
    return {
      todayDateKey,
      generatedAt: now.toISOString(),
      kpisByRestaurantId: Object.fromEntries(kpisByRestaurantId),
    };
  });
}
