import { auditMoney } from '@/lib/audit/money';
import { sumBillableSessionTotal } from '@/lib/billable-session-lines';
import type { Order } from '@/types';

/**
 * Sole settled-close payable: snapshot written at checkout close.
 * Legacy closed rows without snapshot: derive with the same billable projection (needs items).
 */
export function resolveSettledSessionPayable(params: {
  settledPayableAmount?: number | null;
  orders?: Order[];
}): number {
  const raw = params.settledPayableAmount;
  if (raw != null && Number.isFinite(Number(raw))) {
    return auditMoney(Number(raw));
  }
  if (params.orders && params.orders.length > 0) {
    return auditMoney(sumBillableSessionTotal(params.orders));
  }
  return 0;
}

/** Analytics lightweight path when orders lack items jsonb. */
export function resolveSettledSessionPayableForRevenue(params: {
  settledPayableAmount?: number | null;
  orderTotalAmountSum: number;
}): number {
  const raw = params.settledPayableAmount;
  if (raw != null && Number.isFinite(Number(raw))) {
    return auditMoney(Number(raw));
  }
  return auditMoney(params.orderTotalAmountSum);
}
