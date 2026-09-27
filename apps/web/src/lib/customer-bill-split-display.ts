import {
  outstandingAmount,
  totalCollectedAmount,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import {
  buildSplitSettlementRows,
  type SplitSettlementStatus,
} from '@/lib/checkout-split-settlement';
import type { SplitResult } from '@/types';

/** Bill page split rows: draft while editing, persisted snapshot after checkout submit. */
export function billSplitDisplayResults(params: {
  checkoutSubmitted: boolean;
  persistedResult: SplitResult[] | null;
  draftResults: SplitResult[];
}): SplitResult[] {
  const { checkoutSubmitted, persistedResult, draftResults } = params;
  if (checkoutSubmitted && persistedResult?.length) {
    return persistedResult;
  }
  return draftResults;
}

/** Hydrate persisted snapshot only for the post-submit success screen. */
export function initialPersistedSplitResult(
  existingResult: SplitResult[] | null | undefined,
  checkoutSubmitted: boolean,
): SplitResult[] | null {
  if (!checkoutSubmitted) return null;
  return existingResult?.length ? existingResult : null;
}

export type CustomerSplitRowDisplay = {
  name: string;
  obligationAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  settlementStatus: SplitSettlementStatus;
};

/** Customer bill: obligation from split result, collection state from session ledger. */
export function buildCustomerSplitDisplayRows(
  resultRows: SplitResult[],
  collectedPayments: SessionCollectedPayment[],
  discountRate = 0,
): CustomerSplitRowDisplay[] {
  return buildSplitSettlementRows(resultRows, collectedPayments, discountRate).map(
    ({ name, obligationAmount, collectedAmount, outstandingAmount, settlementStatus }) => ({
      name,
      obligationAmount,
      collectedAmount,
      outstandingAmount,
      settlementStatus,
    }),
  );
}

/**
 * Customer「呼叫结账」button amount — sole bill-level pending: total − ledger collected
 * (same semantic as checkout summary「待收」; not Σ person outstanding).
 */
export function customerBillCallAmount(params: {
  total: number;
  collectedPayments: SessionCollectedPayment[];
}): number {
  return outstandingAmount(params.total, totalCollectedAmount(params.collectedPayments));
}
