import type { SupabaseClient } from '@supabase/supabase-js';
import type { ResolvedBuffetPriceRow } from '@/lib/buffet-order';
import { loadBuffetConfigVersion } from '@/lib/buffet-config-version';
import { resolveBuffetPricesServer } from '@/lib/resolve-buffet-prices-server';

/**
 * Sole read of「当前可开的套餐」: SQL `buffet_openable_ids` (store's current slot + today's
 * calendar kind has an active in-date rule). Cold open + buffet switch gate and the open list.
 */
export async function loadOpenableBuffetIds(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string[]> {
  const { data, error } = await admin.rpc('buffet_openable_ids', {
    p_restaurant_id: restaurantId,
  });
  if (error) throw new Error(error.message || 'buffet_openable_ids_failed');
  return ((data ?? []) as unknown[]).map((id) => String(id));
}

export type WaiterOpenableFreshness = {
  /** Current nearest slot id, or `none` when the store has no matching slot. */
  slotKey: string;
  /** `restaurants.buffet_config_version`. */
  version: number;
};

export type WaiterOpenableSnapshot = WaiterOpenableFreshness & {
  /** Openable ids that also have an adult price and a child price. */
  openableBuffetIds: string[];
  /** Same ids as `openableBuffetIds`. One snapshot with the list — not a second lookup. */
  pricesByBuffetId: Record<string, ResolvedBuffetPriceRow>;
};

function priceRowIsUsable(
  row: ResolvedBuffetPriceRow | null,
): row is ResolvedBuffetPriceRow {
  if (!row || row.adult_price == null || row.child_price == null) return false;
  return Number.isFinite(Number(row.adult_price)) && Number.isFinite(Number(row.child_price));
}

/** Version + current slot only. The ensure compare. Does not load the list or prices. */
export async function loadWaiterOpenableFreshness(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<WaiterOpenableFreshness> {
  const [slotRes, version] = await Promise.all([
    admin.rpc('buffet_current_slot_id', { p_restaurant_id: restaurantId }),
    loadBuffetConfigVersion(admin, restaurantId),
  ]);
  if (slotRes.error) throw new Error(slotRes.error.message || 'buffet_current_slot_id_failed');
  const slotKey = slotRes.data != null ? String(slotRes.data) : 'none';
  return { slotKey, version };
}

/**
 * Full open list for a cache miss (version or slot changed): ids that have a
 * current adult price and child price, plus those prices. Not used on the
 * unchanged ensure path.
 */
export async function loadWaiterOpenableSnapshot(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<WaiterOpenableSnapshot> {
  const [openableBuffetIds, freshness] = await Promise.all([
    loadOpenableBuffetIds(admin, restaurantId),
    loadWaiterOpenableFreshness(admin, restaurantId),
  ]);
  const resolved = await Promise.all(
    openableBuffetIds.map(async (buffetId) => ({
      buffetId,
      row: await resolveBuffetPricesServer(admin, restaurantId, buffetId),
    })),
  );
  const pricedIds: string[] = [];
  const pricesByBuffetId: Record<string, ResolvedBuffetPriceRow> = {};
  for (const { buffetId, row } of resolved) {
    if (!priceRowIsUsable(row)) continue;
    pricedIds.push(buffetId);
    pricesByBuffetId[buffetId] = {
      adult_price: Number(row.adult_price),
      child_price: Number(row.child_price),
      rule_id: row.rule_id,
      time_slot_id: row.time_slot_id,
    };
  }
  return { openableBuffetIds: pricedIds, pricesByBuffetId, ...freshness };
}
