import { sessionRevenue } from '@/lib/analytics/qualifying';
import {
  buildCheckoutSettlementSummary,
  hasCheckoutCollections,
  type CheckoutSettlementSummary,
} from '@/lib/checkout-settlement';
import {
  outstandingAmount,
  sumCollectedByPersonName,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import type { OrderHistoryBillSplitSummary } from '@/lib/order-history-bill-splits';
import type { Order } from '@/types';
import type {
  OrderHistoryCloseOutcome,
  OrderHistoryListAmountKind,
  OrderHistoryPersonBalance,
  OrderHistorySessionSettlement,
} from '@/lib/order-history/types';

function asBillSplit(split: OrderHistoryBillSplitSummary) {
  return split as Parameters<typeof buildCheckoutSettlementSummary>[0];
}

function hasCollectionActivity(
  split: OrderHistoryBillSplitSummary | undefined,
  collectedPayments: SessionCollectedPayment[],
): boolean {
  if (collectedPayments.length > 0) return true;
  if (!split) return false;
  return hasCheckoutCollections(asBillSplit(split), collectedPayments);
}

export function resolveOrderHistoryCloseOutcome(
  split: OrderHistoryBillSplitSummary | undefined,
  collectedPayments: SessionCollectedPayment[],
): OrderHistoryCloseOutcome {
  if (split?.status === 'paid') return 'fully_paid';

  if (hasCollectionActivity(split, collectedPayments)) {
    return 'partially_collected_closed';
  }

  if (split) return 'unpaid_closed';
  return 'closed_without_billing';
}

function buildSummary(
  split: OrderHistoryBillSplitSummary | undefined,
  collectedPayments: SessionCollectedPayment[],
): CheckoutSettlementSummary | null {
  if (!split) return null;
  return buildCheckoutSettlementSummary(
    asBillSplit(split),
    split.discount_rate ?? 0,
    collectedPayments,
  );
}

function buildPersonBalances(
  split: OrderHistoryBillSplitSummary | undefined,
  collectedPayments: SessionCollectedPayment[],
): OrderHistoryPersonBalance[] {
  if (!split?.result?.length) return [];

  const collectedByPerson = sumCollectedByPersonName(collectedPayments);
  return split.result.map((row) => {
    const name = row.name.trim();
    const collected = collectedByPerson.get(name) ?? 0;
    const owed = Number(row.amount);
    return {
      name,
      owed,
      collected,
      outstanding: outstandingAmount(owed, collected),
    };
  });
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
}): OrderHistorySessionSettlement {
  const { billSplit, collectedPayments, orders } = input;
  const outcome = resolveOrderHistoryCloseOutcome(billSplit, collectedPayments);
  const summary = buildSummary(billSplit, collectedPayments);
  const collectionActivity = hasCollectionActivity(billSplit, collectedPayments);
  const paidRevenue =
    billSplit?.status === 'paid' ? sessionRevenue(orders, [billSplit]) : null;
  const { amount: listAmount, kind: listAmountKind } = listAmountForOutcome(
    outcome,
    summary,
    paidRevenue,
  );

  return {
    outcome,
    summary,
    collectedPayments,
    personBalances: buildPersonBalances(billSplit, collectedPayments),
    suppressVoidItemStyling: collectionActivity,
    listAmount,
    listAmountKind,
    paidRevenue,
  };
}