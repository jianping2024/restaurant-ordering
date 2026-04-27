import type { Order, OrderItem, OrderItemStatus } from '@/types';

type StatusLike = Pick<OrderItem, 'item_status'>;

export function normalizeOrderItemStatus(item: StatusLike, fallback: Order['status']): OrderItemStatus {
  if (item.item_status) return item.item_status;
  if (fallback === 'done') return 'done';
  if (fallback === 'cooking') return 'cooking';
  return 'pending';
}

/** True when every line item is voided (open table with no active kitchen work). */
export function itemsEveryVoided(items: StatusLike[]): boolean {
  const statuses = items.map((item) => item.item_status || 'pending');
  return statuses.length > 0 && statuses.every((status) => status === 'voided');
}

export function deriveOrderStatusFromItems(items: StatusLike[]): Order['status'] {
  const statuses = items.map((item) => item.item_status || 'pending');
  // Keep all-voided orders as pending so kitchen/waiter boards still show the table until new items are added.
  if (itemsEveryVoided(items)) return 'pending';
  if (statuses.length > 0 && statuses.every((status) => status === 'done' || status === 'voided')) return 'done';
  if (statuses.some((status) => status === 'cooking' || status === 'done')) return 'cooking';
  return 'pending';
}
