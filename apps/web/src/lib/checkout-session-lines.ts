import { buildBillableSessionItems } from '@/lib/billable-session-lines';
import { formatOrderItemQuantityLabel } from '@/lib/order-list-display';
import { resolveMenuItemCode } from '@/lib/menu-item-code';
import type { Order, OrderItem } from '@/types';

export type CheckoutDisplayLine = {
  key: string;
  emoji: string;
  name: string;
  quantityLabel: string;
  lineTotal: number;
  itemCode: string | null;
};

function lineName(item: OrderItem): string {
  return (item.name_pt || item.name || item.name_en || item.name_zh || '').trim();
}

/** Billable lines for checkout detail (matches receipt enqueue aggregation). */
export function checkoutLinesFromOrders(
  orders: Order[],
  itemCodeByMenuId: Record<string, string> = {},
): CheckoutDisplayLine[] {
  return buildBillableSessionItems(orders).map(({ key, item }) => ({
    key,
    emoji: item.emoji || '',
    name: lineName(item),
    quantityLabel: formatOrderItemQuantityLabel(item, { headcountStyle: 'receipt' }),
    lineTotal: item.price * item.qty,
    itemCode: resolveMenuItemCode(item, itemCodeByMenuId),
  }));
}
