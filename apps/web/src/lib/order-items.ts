import type { OrderItem } from '@/types';

/** Legacy rows omit `kind` → treated as normal menu lines for kitchen / status. */
export function isBuffetBaseItem(item: Pick<OrderItem, 'kind'>): boolean {
  return item.kind === 'buffet_base';
}

export function kitchenRelevantItems(items: OrderItem[]): OrderItem[] {
  return items.filter((i) => !isBuffetBaseItem(i));
}

/** Stable append-batch key for kitchen, print, and customer ordered lists. */
export function orderItemBatchKey(item: Pick<OrderItem, 'batch_id'>): string {
  return item.batch_id || 'legacy';
}

/** Customer display group key — legacy batches stay scoped per order row. */
export function orderBatchDisplayGroupKey(orderId: string, batchKey: string): string {
  return batchKey === 'legacy' ? `${orderId}:legacy` : batchKey;
}
