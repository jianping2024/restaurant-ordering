import type { Order, OrderItem } from '@/types';
import {
  aggregateBuffetForOrders,
  formatBuffetGuestCountsOptional,
  formatBuffetHeadcountLabel,
} from '@/lib/buffet-order';
import { getMessages } from '@/lib/i18n/messages';
import type { UILanguage } from '@/lib/i18n';
import { isBuffetBaseItem } from '@/lib/order-items';

export interface OrderListDisplayChip {
  key: string;
  emoji: string;
  name: string;
  quantityLabel: string;
  note?: string;
}

export type OrderListGuestLabels = {
  adults: string;
  children: string;
};

export function orderListGuestLabelsFromLang(lang: UILanguage): OrderListGuestLabels {
  const i18n = getMessages(lang).orderHistory;
  return { adults: i18n.buffetAdultsCount, children: i18n.buffetChildrenCount };
}

export type OrderItemListLabelOptions = {
  /** Staff surfaces use compact A7 C3; guest/history use localized segments. */
  headcountStyle?: 'compact' | 'localized';
  guestLabels?: OrderListGuestLabels;
};

function isVoidedItem(item: OrderItem): boolean {
  return item.item_status === 'voided';
}

/** Qty column for menu lines (`× 2`) or buffet headcount (`· A7 C3` / `· 7大人 · 3小孩`). */
export function formatOrderItemQuantityLabel(
  item: Pick<OrderItem, 'kind' | 'qty' | 'adult_count' | 'child_count'>,
  options: OrderItemListLabelOptions = {},
): string {
  if (!isBuffetBaseItem(item)) return `× ${item.qty}`;

  const adults = item.adult_count ?? 0;
  const children = item.child_count ?? 0;

  if (options.headcountStyle === 'compact') {
    return `· ${formatBuffetHeadcountLabel(adults, children)}`;
  }

  const guestLabel = formatBuffetGuestCountsOptional(
    adults,
    children,
    options.guestLabels ?? { adults: '{n}', children: '{n}' },
  );
  return guestLabel ? `· ${guestLabel}` : '';
}

/** Name column only (`🥤 Cola`) — quantity shown separately when needed. */
export function formatOrderItemNameLabel(
  item: Pick<OrderItem, 'emoji' | 'name' | 'name_pt'>,
): string {
  const name = item.name || item.name_pt;
  return `${item.emoji} ${name}`;
}

/** Single order line label shared by waiter, guest menu, and dashboard lists. */
export function formatOrderItemListLabel(
  item: Pick<OrderItem, 'kind' | 'qty' | 'adult_count' | 'child_count' | 'emoji' | 'name' | 'name_pt'>,
  options: OrderItemListLabelOptions = {},
): string {
  const name = item.name || item.name_pt;
  const quantityLabel = formatOrderItemQuantityLabel(item, options);
  return `${item.emoji} ${name} ${quantityLabel}`;
}

/** Print receipt qty column: menu uses xN; buffet uses optional adult/child counts. */
export function formatOrderListItemPrintQty(
  item: OrderItem,
  guestLabels: OrderListGuestLabels,
): string {
  if (!isBuffetBaseItem(item)) return `x${item.qty}`;
  const label = formatOrderItemQuantityLabel(item, { headcountStyle: 'localized', guestLabels });
  return label.startsWith('· ') ? label.slice(2) : (label || '—');
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
  guestLabels: OrderListGuestLabels,
): OrderListDisplayChip[] {
  const chips: OrderListDisplayChip[] = [];
  const buffetSummary = aggregateBuffetForOrders(orders);

  if (buffetSummary) {
    chips.push({
      key: `buffet:${buffetSummary.buffetId}`,
      emoji: '🍽️',
      name: buffetSummary.name,
      quantityLabel: formatOrderItemQuantityLabel(
        {
          kind: 'buffet_base',
          qty: 1,
          adult_count: buffetSummary.adults,
          child_count: buffetSummary.children,
        },
        { headcountStyle: 'localized', guestLabels },
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
          quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'localized', guestLabels }),
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
