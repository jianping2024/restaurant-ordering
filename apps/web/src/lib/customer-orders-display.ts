import type { Order } from '@/types';
import { isKitchenRemakeItem } from '@/lib/order-items';
import { normalizeOrderItemStatus } from '@/lib/order-status';

/** Hide voided / kitchen-remake lines from guest UI (remakes stay staff/kitchen only). */
export function filterOrdersForCustomerDisplay(orders: Order[]): Order[] {
  return orders
    .map((order) => ({
      ...order,
      items: order.items.filter(
        (item) =>
          !isKitchenRemakeItem(item) &&
          normalizeOrderItemStatus(item, order.status) !== 'voided',
      ),
    }))
    .filter((order) => order.items.length > 0);
}
