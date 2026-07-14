import { centsToEuros, eurosToCents } from '@/lib/money-allocation';
import {
  outstandingAmount,
  sumCollectedByPersonIndex,
  totalCollectedAmount,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
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

export type CustomerSplitSettlementStatus = 'due' | 'partial' | 'settled';

export type CustomerSplitRowDisplay = {
  name: string;
  obligationAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  settlementStatus: CustomerSplitSettlementStatus;
};

export function deriveCustomerSplitSettlementStatus(
  obligationAmount: number,
  collectedAmount: number,
): CustomerSplitSettlementStatus {
  const outstanding = outstandingAmount(obligationAmount, collectedAmount);
  if (outstanding <= 0) return 'settled';
  if (collectedAmount > 0) return 'partial';
  return 'due';
}

/** Customer success screen: obligation from split result, collection state from session ledger. */
export function buildCustomerSplitDisplayRows(
  resultRows: SplitResult[],
  collectedPayments: SessionCollectedPayment[],
): CustomerSplitRowDisplay[] {
  const collectedByIndex = sumCollectedByPersonIndex(collectedPayments);
  return resultRows.map((row, index) => {
    const collectedAmount = collectedByIndex.get(index) ?? 0;
    const obligationAmount = row.amount;
    const outstanding = outstandingAmount(obligationAmount, collectedAmount);
    return {
      name: row.name,
      obligationAmount,
      collectedAmount,
      outstandingAmount: outstanding,
      settlementStatus: deriveCustomerSplitSettlementStatus(obligationAmount, collectedAmount),
    };
  });
}

/** Amount shown for one split row (outstanding when partially collected). */
export function splitRowDisplayAmount(row: CustomerSplitRowDisplay): number {
  return row.settlementStatus === 'partial' ? row.outstandingAmount : row.obligationAmount;
}

export function sumSplitDisplayOutstanding(rows: CustomerSplitRowDisplay[]): number {
  const cents = rows.reduce((sum, row) => sum + eurosToCents(row.outstandingAmount), 0);
  return centsToEuros(cents);
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
    return sumSplitDisplayOutstanding(
      buildCustomerSplitDisplayRows(resultRows, collectedPayments),
    );
  }

  return outstandingAmount(total, totalCollectedAmount(collectedPayments));
}
