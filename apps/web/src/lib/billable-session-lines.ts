import {
  activeBuffetLineByBuffetId,
  listActiveBuffetLineSummaries,
} from '@/lib/buffet-order';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import type { Order, OrderItem } from '@/types';

export type BillableSessionItem = {
  key: string;
  item: OrderItem;
};

/** Merge key for billable menu lines (notes ignored). */
export function billableMenuItemMergeKey(item: OrderItem): string {
  return `${item.id}::${item.price}`;
}

/** Active billable lines for checkout detail, receipts, and session totals. */
export function buildBillableSessionItems(orders: Order[]): BillableSessionItem[] {
  const lines: BillableSessionItem[] = [];
  const buffetSummaries = listActiveBuffetLineSummaries(orders);
  const buffetLineById = activeBuffetLineByBuffetId(orders);

  for (const summary of buffetSummaries) {
    const template = buffetLineById.get(summary.buffetId);
    if (!template) continue;
    lines.push({
      key: `buffet:${summary.buffetId}`,
      item: {
        ...template,
        adult_count: summary.adults,
        child_count: summary.children,
        price: summary.amount,
        qty: 1,
      },
    });
  }

  const mergedMenu = new Map<string, { item: OrderItem; qty: number }>();
  for (const order of orders) {
    for (const item of order.items || []) {
      const st = normalizeOrderItemStatus(item, order.status);
      if (st === 'voided') continue;
      if (isBuffetBaseItem(item) && buffetSummaries.length > 0) continue;

      const key = billableMenuItemMergeKey(item);
      const existing = mergedMenu.get(key);
      if (existing) {
        existing.qty += item.qty;
      } else {
        mergedMenu.set(key, { item, qty: item.qty });
      }
    }
  }

  for (const [mergeKey, { item, qty }] of Array.from(mergedMenu.entries())) {
    lines.push({
      key: mergeKey,
      item: { ...item, qty },
    });
  }

  return lines;
}
