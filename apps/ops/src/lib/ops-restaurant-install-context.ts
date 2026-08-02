/**
 * Sole loader for active installation rows → installPhase + lastCheckinAt
 * used by Ops restaurant list, license list, and suspended summary.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveInstallPhase, type InstallPhase } from '@/lib/ops-license-status';

type InstallationRow = {
  restaurant_id: string;
  status: string;
  last_checkin_at: string | null;
  expires_at: string;
  created_at: string;
};

export type RestaurantInstallContext = {
  installPhase: InstallPhase;
  lastCheckinAt: string | null;
  pendingExpiresAt: string | null;
};

const EMPTY: RestaurantInstallContext = {
  installPhase: 'none',
  lastCheckinAt: null,
  pendingExpiresAt: null,
};

export async function loadRestaurantInstallContexts(
  admin: SupabaseClient,
  restaurantIds: string[],
): Promise<Map<string, RestaurantInstallContext>> {
  const map = new Map<string, RestaurantInstallContext>();
  for (const id of restaurantIds) {
    map.set(id, EMPTY);
  }
  if (restaurantIds.length === 0) return map;

  const { data } = await admin
    .from('restaurant_installations')
    .select('restaurant_id, status, last_checkin_at, expires_at, created_at')
    .in('restaurant_id', restaurantIds)
    .in('status', ['pending', 'claimed'])
    .order('created_at', { ascending: false });

  const byRestaurant = new Map<string, InstallationRow[]>();
  for (const row of (data || []) as InstallationRow[]) {
    const list = byRestaurant.get(row.restaurant_id) || [];
    list.push(row);
    byRestaurant.set(row.restaurant_id, list);
  }

  for (const id of restaurantIds) {
    const insts = byRestaurant.get(id) || [];
    const claimed = insts.find((i) => i.status === 'claimed') || null;
    const pending = insts.find((i) => i.status === 'pending') || null;
    map.set(id, {
      installPhase: resolveInstallPhase({
        claimed: Boolean(claimed),
        pending: Boolean(pending),
      }),
      lastCheckinAt: claimed?.last_checkin_at ?? null,
      pendingExpiresAt: pending?.expires_at ?? null,
    });
  }

  return map;
}
