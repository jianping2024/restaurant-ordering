import { coerceCartPrice, coerceCartQty, sumLineTotals } from '@/lib/cart-totals';
import { applyOrderUpdateToWaiterDetail } from '@/lib/waiter-table-detail-apply-order';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { computeOrderTotalsFromItems } from '@/lib/order-item-void/persist-order-items-update';
import type { MenuOrderSubmitSuccess } from '@/lib/menu-order-submit';
import { generateAppendBatchId } from '@/lib/resolve-append-cart-items';
import type { CartItem, MenuItem, Order, OrderItem } from '@/types';

export type StaffOrderAppendOptimisticInput = {
  orders: Order[];
  append: Pick<MenuOrderSubmitSuccess, 'orderId' | 'batchId' | 'sessionId'>;
  cart: CartItem[];
  menuItems: MenuItem[];
  restaurantId: string;
  tableId: string;
  displayName: string;
  batchId?: string;
  nowIso?: string;
};

function menuItemById(menuItems: MenuItem[]): Map<string, MenuItem> {
  return new Map(menuItems.map((row) => [row.id, row]));
}

function cartLinesToOrderItems(
  cart: CartItem[],
  menuById: Map<string, MenuItem>,
  batchId: string,
  addedAt: string,
): OrderItem[] {
  const items: OrderItem[] = [];
  for (const line of cart) {
    const menu = menuById.get(line.menuItemId);
    const namePt = (line.name_pt || menu?.name_pt || '').trim() || '—';
    items.push({
      id: line.menuItemId,
      name: namePt,
      name_pt: namePt,
      name_en: line.name_en ?? menu?.name_en ?? undefined,
      name_zh: line.name_zh ?? menu?.name_zh ?? undefined,
      qty: coerceCartQty(line.qty),
      note: line.note?.trim() || undefined,
      price: coerceCartPrice(line.price ?? menu?.price),
      emoji: line.emoji || menu?.emoji || '🍽️',
      item_code: menu?.item_code?.trim() || null,
      item_status: 'pending',
      batch_id: batchId,
      added_at: addedAt,
    });
  }
  return items;
}

/** Build authoritative-shaped order row after append for waiter table detail optimistic merge. */
export function buildOptimisticOrderAfterStaffAppend(
  input: StaffOrderAppendOptimisticInput,
): Order {
  const batchId = input.batchId ?? input.append.batchId ?? generateAppendBatchId();
  const addedAt = input.nowIso ?? new Date().toISOString();
  const newItems = cartLinesToOrderItems(
    input.cart,
    menuItemById(input.menuItems),
    batchId,
    addedAt,
  );

  const existing = input.orders.find((row) => row.id === input.append.orderId);
  if (existing) {
    const mergedItems = [...(existing.items || []), ...newItems];
    const { nextStatus, total_amount } = computeOrderTotalsFromItems(
      mergedItems,
      existing.status,
    );
    return {
      ...existing,
      session_id: input.append.sessionId ?? existing.session_id,
      items: mergedItems,
      status: nextStatus,
      total_amount,
      updated_at: addedAt,
    };
  }

  const { nextStatus, total_amount } = computeOrderTotalsFromItems(newItems, 'pending');
  return {
    id: input.append.orderId,
    restaurant_id: input.restaurantId,
    session_id: input.append.sessionId ?? null,
    table_id: input.tableId,
    display_name: input.displayName,
    status: nextStatus,
    items: newItems,
    total_amount,
    created_at: addedAt,
    updated_at: addedAt,
  };
}

/** Quick sanity check — optimistic batch total matches cart subtotal before merge quirks. */
export function optimisticAppendBatchTotal(cart: CartItem[]): number {
  return sumLineTotals(cart);
}

/** Merge append outcome into waiter table page model (detail orders[]). */
export function patchWaiterTableModelAfterStaffAppend(
  model: WaiterTablePageModel,
  input: StaffOrderAppendOptimisticInput,
): WaiterTablePageModel {
  const order = buildOptimisticOrderAfterStaffAppend({
    ...input,
    orders: model.detail.orders,
  });
  return {
    ...model,
    detail: applyOrderUpdateToWaiterDetail(model.detail, order),
  };
}
