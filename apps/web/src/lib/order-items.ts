import type { OrderItem } from '@/types';

/** Legacy rows omit `kind` → treated as normal menu lines for kitchen / status. */
export function isBuffetBaseItem(item: Pick<OrderItem, 'kind'>): boolean {
  return item.kind === 'buffet_base';
}

export function kitchenRelevantItems(items: OrderItem[]): OrderItem[] {
  return items.filter((i) => !isBuffetBaseItem(i));
}
