import { coerceCartQty } from '@/lib/cart-totals';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import type { Order, OrderItem, OrderItemStatus } from '@/types';

export type DecrementOrderItemCode =
  | 'invalid_index'
  | 'not_decrementable'
  | 'buffet_line';

export type DecrementOrderItemOutcome = 'decremented' | 'voided';

export type DecrementOrderItemSuccess = {
  ok: true;
  nextItems: OrderItem[];
  outcome: DecrementOrderItemOutcome;
  itemIndex: number;
  before: OrderItem;
  after: OrderItem;
  statusBefore: OrderItemStatus;
};

export type DecrementOrderItemResult =
  | DecrementOrderItemSuccess
  | { ok: false; code: DecrementOrderItemCode };

export function canDecrementOrderItem(
  item: OrderItem,
  orderStatus: Order['status'],
): boolean {
  if (isBuffetBaseItem(item)) return false;
  const status = normalizeOrderItemStatus(item, orderStatus);
  return status === 'pending' || status === 'cooking';
}

export function applyOrderItemDecrement(
  items: OrderItem[],
  itemIndex: number,
  orderStatus: Order['status'],
): DecrementOrderItemResult {
  if (itemIndex < 0 || itemIndex >= items.length) {
    return { ok: false, code: 'invalid_index' };
  }

  const before = items[itemIndex];
  if (isBuffetBaseItem(before)) {
    return { ok: false, code: 'buffet_line' };
  }

  const statusBefore = normalizeOrderItemStatus(before, orderStatus);
  if (!canDecrementOrderItem(before, orderStatus)) {
    return { ok: false, code: 'not_decrementable' };
  }

  const qty = coerceCartQty(before.qty);
  if (qty <= 0) {
    return { ok: false, code: 'not_decrementable' };
  }

  if (qty > 1) {
    const after: OrderItem = { ...before, qty: qty - 1 };
    const nextItems = items.map((item, index) => (index === itemIndex ? after : item));
    return {
      ok: true,
      nextItems,
      outcome: 'decremented',
      itemIndex,
      before,
      after,
      statusBefore,
    };
  }

  const voidedAt = new Date().toISOString();
  const after: OrderItem = {
    ...before,
    qty: 1,
    item_status: 'voided',
    voided_at: voidedAt,
  };
  const nextItems = items.map((item, index) => (index === itemIndex ? after : item));

  return {
    ok: true,
    nextItems,
    outcome: 'voided',
    itemIndex,
    before,
    after,
    statusBefore,
  };
}
