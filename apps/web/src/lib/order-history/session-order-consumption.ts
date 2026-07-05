import { lineTotal } from '@/lib/cart-totals';
import { auditMoney } from '@/lib/audit/money';
import type { Order } from '@/types';

/** Session consumption from order line JSON (includes voided lines kept for audit). */
export function sessionOrderLineConsumption(orders: Order[]): number {
  let total = 0;
  for (const order of orders) {
    for (const item of order.items) {
      total += lineTotal(item);
    }
  }
  return auditMoney(total);
}
