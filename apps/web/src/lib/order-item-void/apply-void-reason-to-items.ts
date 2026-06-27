import type { OrderItem } from '@/types';

/** Stamp void_reason onto newly voided lines before persist. */
export function applyVoidReasonToItems(
  items: OrderItem[],
  newlyVoidedIndexes: number[],
  reason: string,
): OrderItem[] {
  if (newlyVoidedIndexes.length === 0) return items;
  return items.map((item, index) =>
    newlyVoidedIndexes.includes(index) ? { ...item, void_reason: reason } : item,
  );
}
