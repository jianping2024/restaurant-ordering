import type { Order, OrderItem } from '@/types';
import {
  listActiveBuffetLineSummaries,
  formatBuffetGuestCountsOptional,
  formatBuffetHeadcountLabel,
  formatBuffetReceiptQtyLabel,
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
  voided?: boolean;
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
  /** Default staff/billing surfaces use receipt tokens (`· A1-C2`). */
  headcountStyle?: 'receipt' | 'compact' | 'localized';
  guestLabels?: OrderListGuestLabels;
};

function isVoidedItem(item: OrderItem): boolean {
  return item.item_status === 'voided';
}

/** Qty column for menu lines (`× 2`) or buffet headcount (`· A1-C2` / legacy compact/localized). */
export function formatOrderItemQuantityLabel(
  item: Pick<OrderItem, 'kind' | 'qty' | 'adult_count' | 'child_count'>,
  options: OrderItemListLabelOptions = {},
): string {
  if (!isBuffetBaseItem(item)) return `× ${item.qty}`;

  const adults = item.adult_count ?? 0;
  const children = item.child_count ?? 0;

  if (options.headcountStyle === 'compact') {
    const headcountLabel = formatBuffetHeadcountLabel(adults, children);
    return headcountLabel ? `· ${headcountLabel}` : '';
  }

  if (options.headcountStyle === 'receipt' || options.headcountStyle == null) {
    const receiptLabel = formatBuffetReceiptQtyLabel(adults, children);
    return receiptLabel ? `· ${receiptLabel}` : '';
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

/** Print receipt qty column: menu uses xN; buffet uses A1-C2 tokens. */
export function formatOrderListItemPrintQty(item: OrderItem): string {
  if (!isBuffetBaseItem(item)) return `x${item.qty}`;
  return formatBuffetReceiptQtyLabel(item.adult_count ?? 0, item.child_count ?? 0) || '—';
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
): OrderListDisplayChip[] {
  const chips: OrderListDisplayChip[] = [];
  const buffetSummaries = listActiveBuffetLineSummaries(orders);

  for (const summary of buffetSummaries) {
    chips.push({
      key: `buffet:${summary.buffetId}`,
      emoji: '🍽️',
      name: summary.name,
      quantityLabel: formatOrderItemQuantityLabel(
        {
          kind: 'buffet_base',
          qty: 1,
          adult_count: summary.adults,
          child_count: summary.children,
        },
        { headcountStyle: 'receipt' },
      ),
    });
  }

  if (buffetSummaries.length === 0) {
    for (const order of orders) {
      for (const item of order.items) {
        if (!isBuffetBaseItem(item) || isVoidedItem(item)) continue;
        chips.push({
          key: `buffet:${item.id}:${order.id}`,
          emoji: item.emoji || '🍽️',
          name: item.name_pt || item.name,
          quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'receipt' }),
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

/** Detail modal chips include voided lines for audit visibility. */
export function buildOrderHistoryDetailChips(
  orders: Order[],
  options?: { suppressVoidStyling?: boolean },
): OrderListDisplayChip[] {
  const suppressVoidStyling = options?.suppressVoidStyling ?? false;
  const chips: OrderListDisplayChip[] = [];

  for (const order of orders) {
    for (const item of order.items) {
      const voided = isVoidedItem(item);
      const showVoided = voided && !suppressVoidStyling;
      chips.push({
        key: `${order.id}:${item.id}:${item.note ?? ''}:${voided ? 'voided' : 'active'}`,
        emoji: item.emoji || (isBuffetBaseItem(item) ? '🍽️' : '🍽'),
        name: item.name_pt || item.name,
        quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'receipt' }),
        note: item.note,
        ...(showVoided ? { voided: true } : {}),
      });
    }
  }

  return chips;
}
