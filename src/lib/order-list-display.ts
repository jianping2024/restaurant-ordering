import type { Order, OrderItem } from '@/types';
import { aggregateBuffetForOrders, formatBuffetGuestCountsOptional } from '@/lib/buffet-order';
import { isBuffetBaseItem } from '@/lib/order-items';

export interface OrderListDisplayChip {
  key: string;
  emoji: string;
  name: string;
  quantityLabel: string;
  note?: string;
}

function isVoidedItem(item: OrderItem): boolean {
  return item.item_status === 'voided';
}

function buffetChipQuantityLabel(
  adults: number,
  children: number,
  guestLabels: { adults: string; children: string },
): string {
  const guestLabel = formatBuffetGuestCountsOptional(adults, children, guestLabels);
  return guestLabel ? `· ${guestLabel}` : '';
}

/** Print receipt qty column: menu uses xN; buffet uses optional adult/child counts. */
export function formatOrderListItemPrintQty(
  item: OrderItem,
  guestLabels: { adults: string; children: string },
): string {
  if (!isBuffetBaseItem(item)) return `x${item.qty}`;
  const label = formatBuffetGuestCountsOptional(
    item.adult_count ?? 0,
    item.child_count ?? 0,
    guestLabels,
  );
  return label || '—';
}

/** Total countable units for list summary (menu qty + buffet headcount). */
export function countOrderListItems(orders: Order[]): number {
  let total = 0;
  for (const order of orders) {
    for (const item of order.items) {
      if (isVoidedItem(item)) continue;
      if (isBuffetBaseItem(item)) {
        total += (item.adult_count ?? 0) + (item.child_count ?? 0);
      } else {
        total += item.qty;
      }
    }
  }
  return total;
}

export function buildOrderListDisplayChips(
  orders: Order[],
  guestLabels: { adults: string; children: string },
): OrderListDisplayChip[] {
  const chips: OrderListDisplayChip[] = [];
  const buffetSummary = aggregateBuffetForOrders(orders);

  if (buffetSummary) {
    chips.push({
      key: `buffet:${buffetSummary.buffetId}`,
      emoji: '🍽️',
      name: buffetSummary.name,
      quantityLabel: buffetChipQuantityLabel(
        buffetSummary.adults,
        buffetSummary.children,
        guestLabels,
      ),
    });
  } else {
    for (const order of orders) {
      for (const item of order.items) {
        if (!isBuffetBaseItem(item) || isVoidedItem(item)) continue;
        chips.push({
          key: `buffet:${item.id}:${order.id}`,
          emoji: item.emoji || '🍽️',
          name: item.name_pt || item.name,
          quantityLabel: buffetChipQuantityLabel(
            item.adult_count ?? 0,
            item.child_count ?? 0,
            guestLabels,
          ),
        });
      }
    }
  }

  const menuLines = new Map<string, { emoji: string; name: string; qty: number; note?: string }>();
  for (const order of orders) {
    for (const item of order.items) {
      if (isBuffetBaseItem(item) || isVoidedItem(item)) continue;
      const mergeKey = `${item.id}::${item.note ?? ''}`;
      const existing = menuLines.get(mergeKey);
      if (existing) {
        existing.qty += item.qty;
      } else {
        menuLines.set(mergeKey, {
          emoji: item.emoji,
          name: item.name_pt || item.name,
          qty: item.qty,
          note: item.note,
        });
      }
    }
  }

  for (const [mergeKey, line] of Array.from(menuLines.entries())) {
    chips.push({
      key: mergeKey,
      emoji: line.emoji,
      name: line.name,
      quantityLabel: `× ${line.qty}`,
      note: line.note,
    });
  }

  return chips;
}
