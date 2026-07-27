import {
  activeBuffetLineByBuffetId,
  listActiveBuffetLineSummaries,
} from '@/lib/buffet-order';
import { lineTotal } from '@/lib/cart-totals';
import { isBuffetBaseItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';
import {
  allocateSessionSushiLimitedLines,
  sushiLimitedLineKey,
} from '@/lib/sushi-buffet-limits';
import type { Order, OrderItem } from '@/types';

export type BillableSessionItem = {
  key: string;
  item: OrderItem;
  /** Sushi limited dish: this group is billed beyond the table's free allowance. */
  chargeable?: boolean;
};

/** Merge key for billable menu lines (notes ignored). */
export function billableMenuItemMergeKey(item: OrderItem): string {
  return `${item.id}::${item.price}`;
}

type MergedMenuGroup = { item: OrderItem; qty: number; chargeable: boolean };

function addMenuGroup(
  merged: Map<string, MergedMenuGroup>,
  item: OrderItem,
  qty: number,
  unitPrice: number,
  chargeable: boolean,
): void {
  const priced = item.price === unitPrice ? item : { ...item, price: unitPrice };
  const key = billableMenuItemMergeKey(priced);
  const existing = merged.get(key);
  if (existing) {
    existing.qty += qty;
    return;
  }
  merged.set(key, { item: priced, qty, chargeable });
}

/**
 * Active billable lines for checkout detail, receipts, bill splits, and session totals.
 * Sushi limited dishes split here into a free group and a chargeable group — the stored
 * order lines stay exactly as they were ordered.
 */
export function buildBillableSessionItems(orders: Order[]): BillableSessionItem[] {
  const lines: BillableSessionItem[] = [];
  const buffetSummaries = listActiveBuffetLineSummaries(orders);
  const buffetLineById = activeBuffetLineByBuffetId(orders);
  const limitAllocations = allocateSessionSushiLimitedLines(orders);

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

  const mergedMenu = new Map<string, MergedMenuGroup>();
  for (const order of orders) {
    const items = order.items || [];
    for (let itemIdx = 0; itemIdx < items.length; itemIdx += 1) {
      const item = items[itemIdx];
      const st = normalizeOrderItemStatus(item, order.status);
      if (st === 'voided') continue;
      if (isBuffetBaseItem(item) && buffetSummaries.length > 0) continue;

      const allocation = limitAllocations.get(sushiLimitedLineKey(order.id, itemIdx));
      if (!allocation) {
        addMenuGroup(mergedMenu, item, item.qty, item.price, false);
        continue;
      }
      if (allocation.freeQty > 0) {
        addMenuGroup(mergedMenu, item, allocation.freeQty, item.price, false);
      }
      if (allocation.chargeableQty > 0) {
        addMenuGroup(
          mergedMenu,
          item,
          allocation.chargeableQty,
          allocation.chargeableUnitPrice,
          true,
        );
      }
    }
  }

  for (const [mergeKey, { item, qty, chargeable }] of Array.from(mergedMenu.entries())) {
    lines.push({
      key: mergeKey,
      item: { ...item, qty },
      ...(chargeable ? { chargeable: true } : {}),
    });
  }

  return lines;
}

/** Session billable total — same basis as bill details, receipts, and checkout. */
export function sumBillableSessionTotal(orders: Order[]): number {
  return buildBillableSessionItems(orders).reduce((sum, { item }) => sum + lineTotal(item), 0);
}
