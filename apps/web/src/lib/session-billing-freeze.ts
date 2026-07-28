import type { SupabaseClient } from '@supabase/supabase-js';
import { persistOrderItemsUpdate } from '@/lib/order-item-void/persist-order-items-update';
import {
  allocateSessionSushiLimitedLines,
  sushiLimitedLineKey,
} from '@/lib/sushi-buffet-limits';
import type { Order, OrderItem } from '@/types';

/**
 * Rewrite limited sushi lines into a free row plus a chargeable row, in place.
 * Everything else (batch, timestamps, kitchen status) is preserved, and classic
 * sessions come back untouched.
 */
export function freezeBillingLinesOnOrders(orders: Order[]): Order[] {
  const allocations = allocateSessionSushiLimitedLines(orders);
  if (allocations.size === 0) return orders;

  return orders.map((order) => {
    const items = order.items || [];
    const nextItems: OrderItem[] = [];
    let changed = false;

    for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
      const item = items[itemIdx];
      const allocation = allocations.get(sushiLimitedLineKey(order.id, itemIdx));
      if (!allocation) {
        nextItems.push(item);
        continue;
      }

      if (allocation.chargeableQty <= 0) {
        if (item.price === 0) {
          nextItems.push(item);
          continue;
        }
        changed = true;
        nextItems.push({ ...item, price: 0 });
        continue;
      }

      const alreadyFrozen =
        allocation.freeQty === 0 && item.price === allocation.chargeableUnitPrice;
      if (alreadyFrozen) {
        nextItems.push(item);
        continue;
      }

      changed = true;
      if (allocation.freeQty > 0) {
        nextItems.push({ ...item, qty: allocation.freeQty, price: 0 });
      }
      nextItems.push({
        ...item,
        qty: allocation.chargeableQty,
        price: allocation.chargeableUnitPrice,
      });
    }

    return changed ? { ...order, items: nextItems } : order;
  });
}

/**
 * Freeze the session's billing allocation into stored order lines. Called once when the
 * money is committed (frontdesk checkout close), because the closing RPC prices the
 * session from `orders.items` in SQL. Read paths derive the same split without writing.
 */
export async function freezeSessionBillingLines(
  admin: SupabaseClient,
  restaurantId: string,
  orders: Order[],
): Promise<{ ok: true; orders: Order[] } | { ok: false; message: string }> {
  const frozen = freezeBillingLinesOnOrders(orders);
  const nextOrders: Order[] = [];

  for (let idx = 0; idx < frozen.length; idx += 1) {
    const order = frozen[idx];
    if (order === orders[idx]) {
      nextOrders.push(order);
      continue;
    }

    const persisted = await persistOrderItemsUpdate(admin, {
      orderId: order.id,
      restaurantId,
      updatedAt: order.updated_at,
      items: order.items,
      orderStatusFallback: order.status,
    });
    if (!persisted.ok) {
      return { ok: false, message: `order_update_conflict:${order.id}` };
    }
    nextOrders.push(persisted.order);
  }

  return { ok: true, orders: nextOrders };
}
