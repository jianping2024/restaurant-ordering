import type { Order, OrderItem } from '@/types';
import { normalizeOrderItemStatus } from '@/lib/order-status';

export type CheckoutDisplayLine = {
  key: string;
  emoji: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  status: 'pending' | 'cooking' | 'done' | 'voided';
};

function lineName(item: OrderItem): string {
  return (item.name_pt || item.name || item.name_en || item.name_zh || '').trim();
}

/** Billable lines for a table session (matches BillPage / receipt enqueue). */
export function checkoutLinesFromOrders(orders: Order[]): CheckoutDisplayLine[] {
  const lines: CheckoutDisplayLine[] = [];
  for (const order of orders) {
    (order.items || []).forEach((item, idx) => {
      const status = normalizeOrderItemStatus(item, order.status);
      lines.push({
        key: `${order.id}-${idx}`,
        emoji: item.emoji || '',
        name: lineName(item),
        qty: item.qty,
        unitPrice: item.price,
        lineTotal: item.price * item.qty,
        status,
      });
    });
  }
  return lines;
}
