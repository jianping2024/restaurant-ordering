import type { Order } from '@/types';
import { normalizeOrderItemStatus } from '@/lib/order-status';

/** Hide voided lines/orders (e.g. buffet rows superseded by table merge) from guest UI. */
export function filterOrdersForCustomerDisplay(orders: Order[]): Order[] {
  return orders
    .map((order) => ({
      ...order,
      items: order.items.filter(
        (item) => normalizeOrderItemStatus(item, order.status) !== 'voided',
      ),
    }))
    .filter((order) => order.items.length > 0);
}
