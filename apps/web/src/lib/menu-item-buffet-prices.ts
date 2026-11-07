import type { SupabaseClient } from '@supabase/supabase-js';
import type { MenuItemBuffetPriceMap } from '@/lib/instore-takeaway';
import { parseTableIdParam } from '@/lib/restaurant-tables';

/** One `menu_item_buffet_prices` row as read by catalog / append / dashboard. */
export type MenuItemBuffetPriceRow = {
  menu_item_id: string;
  buffet_id: string;
  price: number | string;
};

/** Dish form entry (`buffet_prices` in the dish body): price ≥ 0, one row per buffet. */
export type MenuItemBuffetPriceInput = { buffet_id: string; price: number };

function buildMenuItemBuffetPriceMap(
  rows: readonly MenuItemBuffetPriceRow[],
): MenuItemBuffetPriceMap {
  const map: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) continue;
    (map[row.menu_item_id] ??= {})[row.buffet_id] = price;
  }
  return map;
}

/**
 * Sole read of configured buffet prices. Whole restaurant (catalog) or one buffet for the
 * given dishes (append / round line). Throws on query error — callers fail the request.
 */
export async function loadMenuItemBuffetPriceMap(
  admin: SupabaseClient,
  restaurantId: string,
  scope?: { buffetId: string; menuItemIds: readonly string[] },
): Promise<MenuItemBuffetPriceMap> {
  if (scope && scope.menuItemIds.length === 0) return {};
  let query = admin
    .from('menu_item_buffet_prices')
    .select('menu_item_id, buffet_id, price')
    .eq('restaurant_id', restaurantId);
  if (scope) {
    query = query.eq('buffet_id', scope.buffetId).in('menu_item_id', Array.from(new Set(scope.menuItemIds)));
  }
  const { data, error } = await query;
  if (error) throw new Error('menu_item_buffet_prices_query_failed');
  return buildMenuItemBuffetPriceMap((data ?? []) as MenuItemBuffetPriceRow[]);
}

/**
 * Dish body `buffet_prices` (required — the save replaces the whole set): array of
 * `{ buffet_id, price }`, price a finite number ≥ 0 (rounded to cents), no duplicate buffet.
 * Missing / invalid → null (400).
 */
export function parseMenuItemBuffetPricesBody(raw: unknown): MenuItemBuffetPriceInput[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MenuItemBuffetPriceInput[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null;
    const row = entry as { buffet_id?: unknown; price?: unknown };
    const buffetId = typeof row.buffet_id === 'string' ? parseTableIdParam(row.buffet_id) : null;
    if (!buffetId || seen.has(buffetId)) return null;
    if (typeof row.price !== 'number' || !Number.isFinite(row.price) || row.price < 0) return null;
    seen.add(buffetId);
    out.push({ buffet_id: buffetId, price: Math.round(row.price * 100) / 100 });
  }
  return out;
}
