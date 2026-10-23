import type { OrderItem } from '@/types';

/** Legacy rows omit `kind` → treated as normal menu lines for kitchen / status. */
export function isBuffetBaseItem(item: Pick<OrderItem, 'kind'>): boolean {
  return item.kind === 'buffet_base';
}

/** Checkout open-price take-away charge (not a menu dish; no kitchen, no catalog id). */
export function isTakeawayChargeItem(item: Pick<OrderItem, 'kind'>): boolean {
  return item.kind === 'takeaway';
}

/**
 * Sole "this line is a menu_items dish" predicate: `id` is a menu uuid, kitchen-relevant,
 * counted as a dish. False for buffet headcount and take-away charges.
 */
export function isMenuCatalogItem(item: Pick<OrderItem, 'kind'>): boolean {
  return !isBuffetBaseItem(item) && !isTakeawayChargeItem(item);
}

/** Kitchen remake lines: staff-only, €0, hidden from guest submitted list and billables. */
export function isKitchenRemakeItem(item: Pick<OrderItem, 'kitchen_remake'>): boolean {
  return item.kitchen_remake === true;
}

export function kitchenRelevantItems(items: OrderItem[]): OrderItem[] {
  return items.filter(isMenuCatalogItem);
}

/** Stable append-batch key for kitchen, print, and customer ordered lists. */
export function orderItemBatchKey(item: Pick<OrderItem, 'batch_id'>): string {
  return item.batch_id || 'legacy';
}

/** Customer display group key — legacy batches stay scoped per order row. */
export function orderBatchDisplayGroupKey(orderId: string, batchKey: string): string {
  return batchKey === 'legacy' ? `${orderId}:legacy` : batchKey;
}
