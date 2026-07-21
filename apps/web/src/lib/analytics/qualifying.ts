import { auditMoney } from '@/lib/audit/money';
import { aggregateBuffetHeadcountForOrders } from '@/lib/buffet-order';
import type { BillSplit, Order, SplitResult } from '@/types';

function applyDiscountToAmount(amount: number, discountRate: number): number {
  const factor = 1 - Math.min(100, Math.max(0, discountRate)) / 100;
  return auditMoney(amount * factor);
}

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
  splits: Pick<BillSplit, 'status' | 'result' | 'total_amount' | 'discount_rate'>[],
  sessionClosed: boolean = false,
): number {
  const paidSplits = splits.filter((split) => split.status === 'paid');
  if (paidSplits.length > 0) {
    let total = 0;
    for (const split of paidSplits) {
      const discountRate = Number(split.discount_rate) || 0;
      const rows = (split.result || []) as SplitResult[];
      for (const row of rows) {
        if (row.paid === true) {
          const discountedAmount = applyDiscountToAmount(Number(row.amount) || 0, discountRate);
          total += discountedAmount;
        }
      }
    }
    if (total <= 0) {
      const splitTotal = paidSplits.reduce((sum, split) => sum + (Number(split.total_amount) || 0), 0);
      const avgDiscountRate = paidSplits.length > 0
        ? paidSplits.reduce((sum, split) => sum + (Number(split.discount_rate) || 0), 0) / paidSplits.length
        : 0;
      total = applyDiscountToAmount(splitTotal, avgDiscountRate);
    }
    return auditMoney(total);
  }

  const orderTotal = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

  if (!sessionClosed) {
    return 0;
  }

  const discountSplits = splits.filter(
    (split) => split.status !== 'cancelled' && split.status !== 'paid',
  );
  if (discountSplits.length > 0) {
    const lastSplit = discountSplits[discountSplits.length - 1]!;
    const discountRate = Number(lastSplit.discount_rate) || 0;
    return applyDiscountToAmount(orderTotal, discountRate);
  }

  return auditMoney(orderTotal);
}

export function sessionGuestCounts(
  orders: Array<Pick<Order, 'items' | 'status'>>,
): { adults: number; children: number } {
  const headcount = aggregateBuffetHeadcountForOrders(orders);
  if (!headcount) return { adults: 0, children: 0 };
  return headcount;
}
