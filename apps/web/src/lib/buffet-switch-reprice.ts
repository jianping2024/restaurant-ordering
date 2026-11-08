import type { SupabaseClient } from '@supabase/supabase-js';
import type { BuffetServiceMode } from '@mesa/shared';
import { BUFFET_CHANGED } from '@/lib/buffet-checkout-entry';
import type { MenuItemBuffetPriceMap, OrderingChannel } from '@/lib/instore-takeaway';
import { loadMenuItemBuffetPriceMap } from '@/lib/menu-item-buffet-prices';
import { isKitchenRemakeItem, isMenuCatalogItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import {
  loadMenuItemsByIds,
  resolveMenuLinePriceFields,
  type MenuItemRow,
} from '@/lib/resolve-append-cart-items';
import type { Order, OrderItem } from '@/types';

/** One dish line's new price fields, addressed by order + index (+ dish + batch check under lock). */
export type BuffetSwitchLinePrice = {
  order_id: string;
  index: number;
  menu_item_id: string;
  batch_id: string | null;
  price: number;
  /** null → the line is no longer free-limited (keys removed). */
  per_person_qty_limit: number | null;
  over_limit_unit_price: number | null;
};

/**
 * Sole TS「按套餐取价的菜品行」: active, a catalog dish (not headcount / take-away charge /
 * packaging), not a €0 kitchen remake. SQL twin `order_item_is_buffet_priced`.
 */
export function isBuffetPricedDishLine(item: OrderItem, orderStatus: Order['status']): boolean {
  return (
    isMenuCatalogItem(item)
    && !isKitchenRemakeItem(item)
    && normalizeOrderItemStatus(item, orderStatus) !== 'voided'
  );
}

/**
 * Re-price every active dish line for the table's new buffet through the append pricing path
 * (`resolveMenuLinePriceFields`); only price + sushi allowance change. A dish deleted from
 * the menu keeps its stored price.
 */
export function planBuffetSwitchLinePrices(params: {
  orders: Array<Pick<Order, 'id' | 'items' | 'status'>>;
  menuById: ReadonlyMap<string, MenuItemRow>;
  buffetId: string | null;
  buffetPrices: MenuItemBuffetPriceMap;
  serviceMode: BuffetServiceMode;
  channel: OrderingChannel;
}): BuffetSwitchLinePrice[] {
  const out: BuffetSwitchLinePrice[] = [];
  for (const order of params.orders) {
    (order.items ?? []).forEach((item, index) => {
      if (!isBuffetPricedDishLine(item, order.status)) return;
      const menu = params.menuById.get(item.id);
      const base = { order_id: order.id, index, menu_item_id: item.id, batch_id: item.batch_id ?? null };
      if (!menu) {
        out.push({
          ...base,
          price: Number(item.price) || 0,
          per_person_qty_limit: item.per_person_qty_limit ?? null,
          over_limit_unit_price: item.over_limit_unit_price ?? null,
        });
        return;
      }
      const { unitPrice, limitRule } = resolveMenuLinePriceFields({
        menu,
        channel: params.channel,
        buffetId: params.buffetId,
        buffetPrices: params.buffetPrices,
        serviceMode: params.serviceMode,
      });
      out.push({
        ...base,
        price: unitPrice,
        per_person_qty_limit: limitRule?.per_person_qty_limit ?? null,
        over_limit_unit_price: limitRule?.over_limit_unit_price ?? null,
      });
    });
  }
  return out;
}

export type SwitchTableBuffetResult =
  | { ok: true }
  | { ok: false; status: number; code: string; message?: string };

/** Re-read attempts when someone appended dishes between our read and the locked write. */
const SWITCH_MAX_ATTEMPTS = 3;

/**
 * Sole buffet change write (X→Y, X→none, none→X on an open table): re-price dish lines for
 * `toBuffetId`, then RPC `switch_table_buffet` checks `fromBuffetId` + line coverage under the
 * session lock. `lines_changed` → re-read orders and retry; `buffet_changed` → 409 to the caller.
 */
export async function switchTableBuffet(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    sessionId: string;
    tableId: string;
    displayName: string;
    fromBuffetId: string | null;
    toBuffetId: string | null;
    buffetLine: OrderItem | null;
    serviceMode: BuffetServiceMode;
    channel: OrderingChannel;
    loadOrders: () => Promise<Order[]>;
  },
): Promise<SwitchTableBuffetResult> {
  for (let attempt = 0; attempt < SWITCH_MAX_ATTEMPTS; attempt += 1) {
    const orders = await params.loadOrders();
    const dishIds = orders.flatMap((order) =>
      (order.items ?? [])
        .filter((item) => isBuffetPricedDishLine(item, order.status))
        .map((item) => item.id),
    );
    const [menuRows, buffetPrices] = await Promise.all([
      loadMenuItemsByIds(admin, params.restaurantId, dishIds),
      params.toBuffetId
        ? loadMenuItemBuffetPriceMap(admin, params.restaurantId, {
            buffetId: params.toBuffetId,
            menuItemIds: dishIds,
          })
        : Promise.resolve({}),
    ]);
    const linePrices = planBuffetSwitchLinePrices({
      orders,
      menuById: new Map(menuRows.map((row) => [row.id, row])),
      buffetId: params.toBuffetId,
      buffetPrices,
      serviceMode: params.serviceMode,
      channel: params.channel,
    });

    const { data, error } = await admin.rpc('switch_table_buffet', {
      p_restaurant_id: params.restaurantId,
      p_session_id: params.sessionId,
      p_table_id: params.tableId,
      p_display_name: params.displayName,
      p_from_buffet_id: params.fromBuffetId,
      p_buffet_line: params.buffetLine,
      p_line_prices: linePrices,
    });
    if (error) return { ok: false, status: 500, code: 'switch_failed', message: error.message };
    const row = (data ?? {}) as { ok?: boolean; code?: string };
    if (row.ok) return { ok: true };
    if (row.code === 'lines_changed') continue;
    if (row.code === BUFFET_CHANGED) return { ok: false, status: 409, code: BUFFET_CHANGED };
    return { ok: false, status: 500, code: row.code || 'switch_failed' };
  }
  return { ok: false, status: 409, code: 'lines_changed' };
}
