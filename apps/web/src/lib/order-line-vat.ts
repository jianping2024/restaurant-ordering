/**
 * Sole IVA lookup for billable order lines (fiscal invoice payload + paper receipt).
 * Menu → `menu_items.vat_rate`; buffet headcount → `buffets.vat_rate`;
 * take-away charge → `restaurants.takeaway_vat_rate`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { distinctMenuItemIdsFromOrders } from '@/lib/menu-item-code';
import { isBuffetBaseItem, isTakeawayChargeItem } from '@/lib/order-items';
import type { Order, OrderItem } from '@/types';

export type OrderLineVatRates = {
  byMenuId: Record<string, number>;
  byBuffetId: Record<string, number>;
  /** Null when the session has no take-away line (not loaded). */
  takeaway: number | null;
};

export const EMPTY_ORDER_LINE_VAT_RATES: OrderLineVatRates = {
  byMenuId: {},
  byBuffetId: {},
  takeaway: null,
};

/** Buffet uuid from a buffet_base order line (fail-closed when missing). */
export function buffetIdFromOrderItem(item: OrderItem): string | null {
  if (!isBuffetBaseItem(item)) return null;
  const raw = (item.buffet_id || item.id.replace(/^buffet:/, '')).trim();
  return raw || null;
}

function finiteRate(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** IVA percent points for one line; null = unknown (callers fail closed). */
export function vatPercentForOrderItem(
  item: OrderItem,
  rates: OrderLineVatRates,
): number | null {
  if (isTakeawayChargeItem(item)) return rates.takeaway;
  if (isBuffetBaseItem(item)) {
    const buffetId = buffetIdFromOrderItem(item);
    return buffetId ? finiteRate(rates.byBuffetId[buffetId]) : null;
  }
  return item.id ? finiteRate(rates.byMenuId[item.id]) : null;
}

function distinctBuffetIdsFromOrders(orders: Order[]): string[] {
  const ids = new Set<string>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const id = buffetIdFromOrderItem(item);
      if (id) ids.add(id);
    }
  }
  return Array.from(ids);
}

/** Load only the rates the session's lines need. */
export async function loadOrderLineVatRates(
  admin: SupabaseClient,
  restaurantId: string,
  orders: Order[],
): Promise<OrderLineVatRates> {
  const rates: OrderLineVatRates = { byMenuId: {}, byBuffetId: {}, takeaway: null };

  const menuIds = distinctMenuItemIdsFromOrders(orders);
  const buffetIds = distinctBuffetIdsFromOrders(orders);
  const hasTakeaway = orders.some((order) => (order.items ?? []).some(isTakeawayChargeItem));

  const [menuRes, buffetRes, restaurantRes] = await Promise.all([
    menuIds.length > 0
      ? admin
          .from('menu_items')
          .select('id, vat_rate')
          .eq('restaurant_id', restaurantId)
          .in('id', menuIds)
      : Promise.resolve({ data: [] as Array<{ id: string; vat_rate: unknown }> }),
    buffetIds.length > 0
      ? admin
          .from('buffets')
          .select('id, vat_rate')
          .eq('restaurant_id', restaurantId)
          .in('id', buffetIds)
      : Promise.resolve({ data: [] as Array<{ id: string; vat_rate: unknown }> }),
    hasTakeaway
      ? admin.from('restaurants').select('takeaway_vat_rate').eq('id', restaurantId).maybeSingle()
      : Promise.resolve({ data: null as { takeaway_vat_rate: unknown } | null }),
  ]);

  for (const row of menuRes.data ?? []) {
    const rate = finiteRate(row.vat_rate);
    if (rate != null) rates.byMenuId[String(row.id)] = rate;
  }
  for (const row of buffetRes.data ?? []) {
    const rate = finiteRate(row.vat_rate);
    if (rate != null) rates.byBuffetId[String(row.id)] = rate;
  }
  // PostgREST returns numeric as number; tolerate string form.
  const takeawayRaw = restaurantRes.data?.takeaway_vat_rate;
  rates.takeaway = finiteRate(typeof takeawayRaw === 'string' ? Number(takeawayRaw) : takeawayRaw);

  return rates;
}
