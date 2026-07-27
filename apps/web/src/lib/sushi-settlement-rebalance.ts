import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderItem } from '@/types';
import {
  isSushiBuffetMode,
  normalizeBuffetServiceMode,
  type BuffetServiceMode,
} from '@/lib/buffet-service-mode';
import { computeOrderTotalsFromItems } from '@/lib/order-item-void/persist-order-items-update';
import {
  collectSessionMenuItemIds,
  isActiveSessionMenuLine,
  isLimitedSushiMenuItem,
  sessionGuestCountForLimits,
  settlementPriceSlicesForLimitedItem,
  type ApplySushiLimitError,
  type SushiLimitCatalogRow,
} from '@/lib/sushi-buffet-limits';

export type SushiSettlementRebalanceResult =
  | { ok: true; orders: Order[]; changed: boolean }
  | {
      ok: false;
      error: ApplySushiLimitError | 'catalog_lookup_failed' | 'persist_failed';
      message?: string;
    };

export type SushiSettlementFailureCode = Exclude<
  SushiSettlementRebalanceResult,
  { ok: true }
>['error'];

/** One HTTP mapping for settlement failures across checkout / receipt / close. */
export function httpStatusForSushiSettlementError(error: SushiSettlementFailureCode): number {
  if (error === 'limited_item_requires_headcount' || error === 'over_limit_price_missing') {
    return 400;
  }
  return 500;
}

async function loadRestaurantBuffetServiceMode(
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

async function loadMenuSushiLimitCatalog(
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

function ordersPricingFingerprint(orders: Order[]): string {
  const parts: string[] = [];
  for (const order of orders) {
    for (const item of order.items || []) {
      if (!isActiveSessionMenuLine(item, order.status)) continue;
      parts.push(`${order.id}:${item.id}:${item.qty}:${Number(item.price)}:${item.item_status ?? ''}`);
    }
  }
  return parts.join('|');
}

/**
 * Pure: rewrite limited sushi lines so free allowance uses menu price and the rest
 * uses overage price. Classic / unlimited untouched. Collapses prior split garbage.
 */
export function rebalanceOrdersForSushiSettlement(params: {
  serviceMode: unknown;
  orders: Order[];
  catalog: Iterable<SushiLimitCatalogRow>;
}): { ok: true; orders: Order[] } | { ok: false; error: ApplySushiLimitError } {
  if (!isSushiBuffetMode(params.serviceMode)) {
    return { ok: true, orders: params.orders };
  }

  const catalogById = new Map<string, SushiLimitCatalogRow>();
  for (const row of params.catalog) catalogById.set(row.id, row);

  const guestCount = sessionGuestCountForLimits(params.orders);
  const limitedIds: string[] = [];
  for (const row of catalogById.values()) {
    if (isLimitedSushiMenuItem(params.serviceMode, row)) limitedIds.push(row.id);
  }
  if (limitedIds.length === 0) {
    return { ok: true, orders: params.orders };
  }

  const hasLimitedLines = params.orders.some((order) =>
    (order.items || []).some(
      (item) => limitedIds.includes(item.id) && isActiveSessionMenuLine(item, order.status),
    ),
  );
  if (!hasLimitedLines) {
    return { ok: true, orders: params.orders };
  }

  if (guestCount < 1) {
    return { ok: false, error: 'limited_item_requires_headcount' };
  }

  let orders: Order[] = params.orders.map((order) => ({
    ...order,
    items: [...(order.items || [])],
  }));

  for (const menuItemId of limitedIds) {
    const cat = catalogById.get(menuItemId)!;
    const collected: OrderItem[] = [];
    let targetOrderIdx = -1;

    orders = orders.map((order, orderIdx) => {
      const nextItems: OrderItem[] = [];
      for (const item of order.items || []) {
        if (item.id === menuItemId && isActiveSessionMenuLine(item, order.status)) {
          if (targetOrderIdx < 0) targetOrderIdx = orderIdx;
          collected.push(item);
          continue;
        }
        nextItems.push(item);
      }
      return { ...order, items: nextItems };
    });

    if (collected.length === 0 || targetOrderIdx < 0) continue;

    const totalQty = collected.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0);
    const priced = settlementPriceSlicesForLimitedItem({
      serviceMode: params.serviceMode,
      guestCount,
      totalQty,
      menuPrice: cat.price,
      item: cat,
    });
    if (!priced.ok) return { ok: false, error: priced.error };

    const template = collected[0];
    const rebuilt: OrderItem[] = priced.slices.map((slice) => ({
      ...template,
      qty: slice.qty,
      price: slice.unitPrice,
      voided_at: undefined,
      void_reason: undefined,
      item_status:
        template.item_status && template.item_status !== 'voided'
          ? template.item_status
          : 'pending',
    }));

    orders = orders.map((order, idx) => {
      if (idx !== targetOrderIdx) return order;
      return { ...order, items: [...order.items, ...rebuilt] };
    });
  }

  orders = orders.map((order) => {
    const { nextStatus, total_amount } = computeOrderTotalsFromItems(order.items, order.status);
    return { ...order, status: nextStatus, total_amount };
  });

  return { ok: true, orders };
}

/**
 * Apply sushi settlement pricing and persist when changed.
 * Classic / no limited items → no-op success.
 */
export async function ensureSushiSettlementPricingForSession(
  admin: SupabaseClient,
  restaurantId: string,
  sessionId: string,
  orders: Order[],
): Promise<SushiSettlementRebalanceResult> {
  let serviceMode: BuffetServiceMode;
  try {
    serviceMode = await loadRestaurantBuffetServiceMode(admin, restaurantId);
  } catch (err) {
    return {
      ok: false,
      error: 'catalog_lookup_failed',
      message: err instanceof Error ? err.message : 'service_mode_lookup_failed',
    };
  }

  if (!isSushiBuffetMode(serviceMode)) {
    return { ok: true, orders, changed: false };
  }

  const menuItemIds = collectSessionMenuItemIds(orders);
  if (menuItemIds.length === 0) {
    return { ok: true, orders, changed: false };
  }

  let catalog: SushiLimitCatalogRow[];
  try {
    catalog = await loadMenuSushiLimitCatalog(admin, restaurantId, menuItemIds);
  } catch (err) {
    return {
      ok: false,
      error: 'catalog_lookup_failed',
      message: err instanceof Error ? err.message : 'menu_catalog_lookup_failed',
    };
  }

  const planned = rebalanceOrdersForSushiSettlement({
    serviceMode,
    orders,
    catalog,
  });
  if (!planned.ok) return planned;

  if (ordersPricingFingerprint(orders) === ordersPricingFingerprint(planned.orders)) {
    return { ok: true, orders: planned.orders, changed: false };
  }

  for (const order of planned.orders) {
    const prior = orders.find((o) => o.id === order.id);
    if (!prior) continue;
    if (ordersPricingFingerprint([prior]) === ordersPricingFingerprint([order])) continue;

    const { data, error } = await admin
      .from('orders')
      .update({
        items: order.items,
        status: order.status,
        total_amount: order.total_amount,
      })
      .eq('id', order.id)
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId)
      .eq('updated_at', prior.updated_at)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      return {
        ok: false,
        error: 'persist_failed',
        message: error?.message || 'order_update_conflict',
      };
    }
  }

  const { data: refreshed, error: reloadErr } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (reloadErr) {
    return { ok: false, error: 'persist_failed', message: reloadErr.message };
  }

  return { ok: true, orders: (refreshed as Order[]) || planned.orders, changed: true };
}
