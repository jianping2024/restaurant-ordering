import type { Order, OrderItem, OrderItemStatus } from '@/types';
import { isBuffetBaseItem, kitchenRelevantItems } from '@/lib/order-items';

type StatusLike = Pick<OrderItem, 'item_status' | 'kind'>;

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

/**
 * Order-level status follows kitchen-relevant lines only.
 * Buffet-only (or buffet + all menu voided) → done so the ticket leaves the kitchen column.
 */
export function deriveOrderStatusFromItems(items: OrderItem[]): Order['status'] {
  const kitchen = kitchenRelevantItems(items);
  if (kitchen.length === 0) {
    if (items.length === 0) return 'pending';
    if (items.some((i) => isBuffetBaseItem(i))) return 'done';
    return 'pending';
  }
  if (itemsEveryVoided(kitchen)) return 'pending';
  const statuses = kitchen.map((item) => item.item_status || 'pending');
  if (statuses.length > 0 && statuses.every((status) => status === 'done' || status === 'voided')) return 'done';
  if (statuses.some((status) => status === 'cooking' || status === 'done')) return 'cooking';
  return 'pending';
}
