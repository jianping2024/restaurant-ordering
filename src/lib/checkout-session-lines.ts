import type { Order, OrderItem } from '@/types';
import { resolveMenuItemCode } from '@/lib/menu-item-code';

export type CheckoutDisplayLine = {
  key: string;
  emoji: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  itemCode: string | null;
};

function lineName(item: OrderItem): string {
  return (item.name_pt || item.name || item.name_en || item.name_zh || '').trim();
}

/** Billable lines for a table session (matches BillPage / receipt enqueue). */
export function checkoutLinesFromOrders(
  orders: Order[],
  itemCodeByMenuId: Record<string, string> = {},
): CheckoutDisplayLine[] {
  const lines: CheckoutDisplayLine[] = [];
  for (const order of orders) {
    (order.items || []).forEach((item, idx) => {
      lines.push({
        key: `${order.id}-${idx}`,
        emoji: item.emoji || '',
        name: lineName(item),
        qty: item.qty,
        unitPrice: item.price,
        lineTotal: item.price * item.qty,
        itemCode: resolveMenuItemCode(item, itemCodeByMenuId),
      });
    });
  }
  return lines;
}
