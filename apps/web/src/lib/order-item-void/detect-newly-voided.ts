import type { Order, OrderItem, OrderItemStatus } from '@/types';
import { normalizeOrderItemStatus } from '@/lib/order-status';

export type NewlyVoidedItem = {
  itemIndex: number;
  before: OrderItem;
  after: OrderItem;
  statusBefore: OrderItemStatus;
};

function isVoided(status: OrderItemStatus | undefined): boolean {
  return status === 'voided';
}

export function detectNewlyVoidedItems(
  beforeItems: OrderItem[],
  afterItems: OrderItem[],
  orderStatusFallback: Order['status'] = 'pending',
): NewlyVoidedItem[] {
  const result: NewlyVoidedItem[] = [];
  const len = Math.min(beforeItems.length, afterItems.length);
  for (let itemIndex = 0; itemIndex < len; itemIndex += 1) {
    const before = beforeItems[itemIndex];
    const after = afterItems[itemIndex];
    const statusBefore = normalizeOrderItemStatus(before, orderStatusFallback);
    const statusAfter = normalizeOrderItemStatus(after, orderStatusFallback);
    if (!isVoided(statusBefore) && isVoided(statusAfter)) {
      result.push({ itemIndex, before, after, statusBefore });
    }
  }
  return result;
}
