import { auditMoney } from '@/lib/audit/money';
import { sessionRevenue } from '@/lib/analytics/qualifying';
import {
  buildCheckoutSettlementSummary,
  hasCheckoutCollections,
  type CheckoutSettlementSummary,
} from '@/lib/checkout-settlement';
import {
  clampCheckoutDiscountRate,
  checkoutPayableAmount,
} from '@/lib/checkout-split-math';
import {
  totalCollectedAmount,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';
import { countOrderListItems } from '@/lib/order-list-display';
import { sessionOrderLineConsumption } from '@/lib/order-history/session-order-consumption';
import { isSettledCloseReason } from '@/lib/table-session/operational-close-reasons';
import type { Order } from '@/types';
import type {
  OrderHistoryCloseOutcome,
  OrderHistoryListAmountKind,
  OrderHistorySessionSettlement,
} from '@/lib/order-history/types';

const MONEY_EPSILON = 0.004;

function asBillSplit(split: OrderHistoryBillSplitSummary) {
  return split as Parameters<typeof buildCheckoutSettlementSummary>[0];
}

function isNearZero(amount: number): boolean {
  return Math.abs(amount) < MONEY_EPSILON;
}

function hasCollectionActivity(
  split: OrderHistoryBillSplitSummary | undefined,
  collectedPayments: SessionCollectedPayment[],
): boolean {
  if (collectedPayments.length > 0) return true;
  if (!split) return false;
  return hasCheckoutCollections(asBillSplit(split), collectedPayments);
}

/**
 * One close-outcome resolver: paid ledger OR settled closed_reason → fully_paid.
 * Paths are disjoint in production; force/nightly without paid ledger stays unpaid / without-billing.
 */
export function resolveOrderHistoryCloseOutcome(
  split: OrderHistoryBillSplitSummary | undefined,
  collectedPayments: SessionCollectedPayment[],
  closedReason?: string | null,
): OrderHistoryCloseOutcome {
  if (split?.status === 'paid') return 'fully_paid';
  if (isSettledCloseReason(closedReason)) return 'fully_paid';

  if (hasCollectionActivity(split, collectedPayments)) {
    return 'partially_collected_closed';
  }

  if (split) return 'unpaid_closed';
  return 'closed_without_billing';
}

export function resolveOrderHistoryCanPrintBill(
  outcome: OrderHistoryCloseOutcome,
  orders: Order[],
): boolean {
  return outcome === 'fully_paid' && countOrderListItems(orders) > 0;
}

function payableFromSplitOrConsumption(
  split: OrderHistoryBillSplitSummary,
  consumption: number,
): number {
  const discountRate = split.discount_rate ?? 0;
  const fromRows = checkoutPayableAmount(asBillSplit(split), discountRate);
  if (!isNearZero(fromRows)) return fromRows;

  const factor = 1 - clampCheckoutDiscountRate(discountRate) / 100;
  return auditMoney(consumption * factor);
}

function reconcileHistorySettlementSummary(
  summary: CheckoutSettlementSummary,
  split: OrderHistoryBillSplitSummary | undefined,
  orders: Order[],
): CheckoutSettlementSummary {
  const orderConsumption = sessionOrderLineConsumption(orders);
  const consumption = !isNearZero(summary.consumption)
    ? summary.consumption
    : split && split.total_amount > 0
      ? split.total_amount
      : orderConsumption;

  const discountRate = split?.discount_rate ?? summary.discountRate ?? 0;
  const payable = !isNearZero(summary.payable)
    ? summary.payable
    : split
      ? payableFromSplitOrConsumption(split, consumption)
      : auditMoney(consumption);

  const pending = Math.max(0, Math.round((payable - summary.collected) * 100) / 100);

  return {
    consumption,
    payable,
    discountRate,
    collected: summary.collected,
    pending,
  };
}

/** 关台结账：应付只来自订单；忽略已取消的结账草稿分账；不虚构已收。 */
function buildSettledPayableSummary(orders: Order[]): CheckoutSettlementSummary {
  const consumption = sessionOrderLineConsumption(orders);
  const payable = auditMoney(consumption || sessionRevenue(orders, [], true));
  return {
    consumption: !isNearZero(consumption) ? consumption : payable,
    payable,
    discountRate: 0,
    collected: 0,
    pending: 0,
  };
}

function buildLedgerSummary(
  split: OrderHistoryBillSplitSummary | undefined,
  collectedPayments: SessionCollectedPayment[],
  orders: Order[],
): CheckoutSettlementSummary | null {
  if (split) {
    const base = buildCheckoutSettlementSummary(
      asBillSplit(split),
      split.discount_rate ?? 0,
      collectedPayments,
    );
    return reconcileHistorySettlementSummary(base, split, orders);
  }

  if (collectedPayments.length === 0) return null;

  const collected = totalCollectedAmount(collectedPayments);
  const consumption = sessionOrderLineConsumption(orders);
  const payable = consumption;
  return {
    consumption,
    payable,
    discountRate: 0,
    collected,
    pending: Math.max(0, Math.round((payable - collected) * 100) / 100),
  };
}

function listAmountForOutcome(
  outcome: OrderHistoryCloseOutcome,
  summary: CheckoutSettlementSummary | null,
  paidRevenue: number | null,
): { amount: number | null; kind: OrderHistoryListAmountKind | null } {
  if (outcome === 'fully_paid') {
    const amount = paidRevenue ?? summary?.payable ?? null;
    if (amount == null) return { amount: null, kind: null };
    return { amount, kind: 'paid' };
  }
  if (outcome === 'partially_collected_closed' && summary && summary.collected > 0) {
    return { amount: summary.collected, kind: 'collected' };
  }
  return { amount: null, kind: null };
}

export function buildOrderHistorySessionSettlement(input: {
  billSplit?: OrderHistoryBillSplitSummary;
  collectedPayments: SessionCollectedPayment[];
  orders: Order[];
  closedReason?: string | null;
}): OrderHistorySessionSettlement {
  const { billSplit, collectedPayments, orders, closedReason } = input;
  const outcome = resolveOrderHistoryCloseOutcome(billSplit, collectedPayments, closedReason);

  const ledgerPaid = billSplit?.status === 'paid';
  const settledAttested = !ledgerPaid && isSettledCloseReason(closedReason);

  const summary = settledAttested
    ? buildSettledPayableSummary(orders)
    : buildLedgerSummary(billSplit, collectedPayments, orders);

  const paidRevenue = ledgerPaid
    ? sessionRevenue(orders, [billSplit!])
    : settledAttested
      ? sessionRevenue(orders, [], true)
      : null;

  const { amount: listAmount, kind: listAmountKind } = listAmountForOutcome(
    outcome,
    summary,
    paidRevenue,
  );

  return {
    outcome,
    summary,
    showFinancialDetails: summary != null && !settledAttested,
    collectedPayments,
    listAmount,
    listAmountKind,
    paidRevenue,
    canPrintBill: resolveOrderHistoryCanPrintBill(outcome, orders),
  };
}
