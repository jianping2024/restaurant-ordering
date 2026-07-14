import {
  outstandingAmount,
  totalCollectedAmount,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import {
  buildSplitSettlementRows,
  deriveSplitSettlementStatus,
  sumSplitSettlementOutstanding,
  type SplitSettlementStatus,
} from '@/lib/checkout-split-settlement';
import type { SplitMode, SplitResult } from '@/types';

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

export type CustomerSplitSettlementStatus = SplitSettlementStatus;

export type CustomerSplitRowDisplay = {
  name: string;
  obligationAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  settlementStatus: CustomerSplitSettlementStatus;
};

export const deriveCustomerSplitSettlementStatus = deriveSplitSettlementStatus;

/** Customer bill: obligation from split result, collection state from session ledger. */
export function buildCustomerSplitDisplayRows(
  resultRows: SplitResult[],
  collectedPayments: SessionCollectedPayment[],
): CustomerSplitRowDisplay[] {
  return buildSplitSettlementRows(resultRows, collectedPayments).map(({ name, obligationAmount, collectedAmount, outstandingAmount, settlementStatus }) => ({
    name,
    obligationAmount,
    collectedAmount,
    outstandingAmount,
    settlementStatus,
  }));
}

/** Amount shown for one split row (outstanding when partially collected). */
export function splitRowDisplayAmount(row: CustomerSplitRowDisplay): number {
  return row.settlementStatus === 'partial' ? row.outstandingAmount : row.obligationAmount;
}

export function sumSplitDisplayOutstanding(rows: CustomerSplitRowDisplay[]): number {
  return sumSplitSettlementOutstanding(
    rows.map((row, index) => ({ ...row, index })),
  );
}

/** Customer「呼叫结账」button: full total on first checkout, pending balance after collections. */
export function customerBillCallAmount(params: {
  total: number;
  splitMode: SplitMode | null;
  resultRows: SplitResult[];
  collectedPayments: SessionCollectedPayment[];
}): number {
  const { total, splitMode, resultRows, collectedPayments } = params;
  if (collectedPayments.length === 0) return total;

  if (splitMode && resultRows.length > 0) {
    return sumSplitSettlementOutstanding(
      buildSplitSettlementRows(resultRows, collectedPayments),
    );
  }

  return outstandingAmount(total, totalCollectedAmount(collectedPayments));
}
