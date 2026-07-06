import { auditMoney } from '@/lib/audit/money';
import { aggregateBuffetHeadcountForOrders } from '@/lib/buffet-order';
import type { BillSplit, Order, SplitResult } from '@/types';

export function isQualifyingSession(
  orders: Pick<Order, 'total_amount'>[],
  splits: Pick<BillSplit, 'status'>[],
): boolean {
  const hasPaidSplit = splits.some((split) => split.status === 'paid');
  if (hasPaidSplit) return true;

  const orderTotal = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
  return orderTotal > 0.0001;
}

export function sessionRevenue(
  orders: Pick<Order, 'total_amount'>[],
  splits: Pick<BillSplit, 'status' | 'result' | 'total_amount'>[],
): number {
  const paidSplits = splits.filter((split) => split.status === 'paid');
  if (paidSplits.length > 0) {
    let total = 0;
    for (const split of paidSplits) {
      const rows = (split.result || []) as SplitResult[];
      for (const row of rows) {
        if (row.paid === true) {
          total += Number(row.amount) || 0;
        }
      }
    }
    if (total <= 0) {
      total = paidSplits.reduce((sum, split) => sum + (Number(split.total_amount) || 0), 0);
    }
    return auditMoney(total);
  }

  return auditMoney(orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0));
}

export function sessionGuestCounts(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): { adults: number; children: number } {
  const headcount = aggregateBuffetHeadcountForOrders(orders);
  if (!headcount) return { adults: 0, children: 0 };
  return headcount;
}
