import {
  buildCheckoutSettlementSummary,
  checkoutPaymentProgress,
  hasCheckoutCollections,
} from '@/lib/checkout-settlement';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { BillSplit, BillStatus, SplitMode } from '@/types';

/** Queue wire row — no persons/result jsonb. */
export type CheckoutRequestSummary = {
  id: string;
  session_id: string;
  table_id: string;
  display_name: string;
  created_at: string;
  split_mode: SplitMode;
  status: BillStatus;
  discount_rate: number;
  settlement: {
    consumption: number;
    payable: number;
    collected: number;
    pending: number;
  };
  payment_progress: { paid_count: number; total_count: number };
  partial_paid: boolean;
};

export function buildCheckoutRequestSummary(
  request: BillSplit,
  collectedPayments: SessionCollectedPayment[],
): CheckoutRequestSummary | null {
  if (!request.session_id) return null;
  const discountRate = request.discount_rate ?? 0;
  const settlement = buildCheckoutSettlementSummary(request, discountRate, collectedPayments);
  const progress = checkoutPaymentProgress(request, collectedPayments, discountRate);
  return {
    id: request.id,
    session_id: request.session_id,
    table_id: request.table_id,
    display_name: request.display_name,
    created_at: request.created_at,
    split_mode: request.split_mode,
    status: request.status,
    discount_rate: discountRate,
    settlement: {
      consumption: settlement.consumption,
      payable: settlement.payable,
      collected: settlement.collected,
      pending: settlement.pending,
    },
    payment_progress: {
      paid_count: progress.paidCount,
      total_count: progress.totalCount,
    },
    partial_paid: hasCheckoutCollections(request, collectedPayments),
  };
}

/** Server list replaces local queue; paid optimism lives in the collected ledger. */
export function mergeCheckoutRequestSummariesFromRefresh(
  _prev: CheckoutRequestSummary[],
  incoming: CheckoutRequestSummary[],
): CheckoutRequestSummary[] {
  return incoming;
}

export function upsertCheckoutRequestSummaryInQueue(
  prev: readonly CheckoutRequestSummary[],
  row: CheckoutRequestSummary,
): CheckoutRequestSummary[] {
  const without = prev.filter((entry) => entry.id !== row.id);
  return [...without, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function applyConfirmPaymentToSummaries(
  prev: CheckoutRequestSummary[],
  billSplitId: string,
  outcome: { all_paid: boolean },
): CheckoutRequestSummary[] {
  if (outcome.all_paid) {
    return prev.filter((row) => row.id !== billSplitId);
  }
  return prev;
}
