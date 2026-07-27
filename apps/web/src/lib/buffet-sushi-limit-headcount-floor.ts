import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/types';
import {
  totalGuestsInBuffetSnapshot,
  type BuffetGuestSnapshot,
} from '@/lib/buffet-order';
import {
  isSushiBuffetMode,
  normalizeBuffetServiceMode,
  type BuffetServiceMode,
} from '@/lib/buffet-service-mode';
import {
  collectSessionMenuItemIds,
  sushiFreeAllowanceHeadcountFloor,
  type SushiLimitCatalogRow,
} from '@/lib/sushi-buffet-limits';

export const BUFFET_HEADCOUNT_BELOW_SUSHI_LIMIT_FLOOR =
  'buffet_headcount_below_sushi_limit_floor' as const;

export type SushiLimitHeadcountFloorViolation = {
  minGuests: number;
  proposedGuests: number;
};

/**
 * When proposed total headcount cannot cover included (free) sushi limited portions.
 */
export function findBuffetHeadcountBelowSushiLimitFloor(
  target: BuffetGuestSnapshot,
  minGuests: number,
): SushiLimitHeadcountFloorViolation | null {
  if (minGuests < 1) return null;
  const proposedGuests = totalGuestsInBuffetSnapshot(target);
  if (proposedGuests >= minGuests) return null;
  return { minGuests, proposedGuests };
}

export async function loadRestaurantBuffetServiceMode(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<BuffetServiceMode> {
  const { data, error } = await admin
    .from('restaurants')
    .select('buffet_service_mode')
    .eq('id', restaurantId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message || 'restaurant_service_mode_lookup_failed');
  }
  return normalizeBuffetServiceMode(data?.buffet_service_mode);
}

export async function loadMenuSushiLimitCatalog(
  admin: SupabaseClient,
  restaurantId: string,
  menuItemIds: string[],
): Promise<SushiLimitCatalogRow[]> {
  if (menuItemIds.length === 0) return [];
  const { data, error } = await admin
    .from('menu_items')
    .select('id, price, per_person_qty_limit, over_limit_unit_price')
    .eq('restaurant_id', restaurantId)
    .in('id', menuItemIds);
  if (error) {
    throw new Error(error.message || 'menu_limit_catalog_lookup_failed');
  }
  const rows: SushiLimitCatalogRow[] = [];
  for (const row of data || []) {
    if (!row || typeof row.id !== 'string') continue;
    const price = Number(row.price);
    rows.push({
      id: row.id,
      price: Number.isFinite(price) ? price : 0,
      per_person_qty_limit:
        row.per_person_qty_limit == null ? null : Number(row.per_person_qty_limit),
      over_limit_unit_price:
        row.over_limit_unit_price == null ? null : Number(row.over_limit_unit_price),
    });
  }
  return rows;
}

/**
 * Sushi-mode free-allowance floor for session orders (0 if classic / no limited included qty).
 */
export async function resolveSushiLimitHeadcountFloor(
  admin: SupabaseClient,
  restaurantId: string,
  serviceMode: BuffetServiceMode,
  sessionOrders: Array<Pick<Order, 'items' | 'status'>>,
): Promise<number> {
  if (!isSushiBuffetMode(serviceMode)) return 0;
  const menuItemIds = collectSessionMenuItemIds(sessionOrders);
  if (menuItemIds.length === 0) return 0;
  const catalog = await loadMenuSushiLimitCatalog(admin, restaurantId, menuItemIds);
  return sushiFreeAllowanceHeadcountFloor({
    serviceMode,
    sessionOrders,
    catalog,
  });
}
