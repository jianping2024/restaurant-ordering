import {
  outstandingAmount,
  sumCollectedByPersonName,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
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
  const collectedByPerson = sumCollectedByPersonName(collectedPayments);
  return resultRows.map((row) => {
    const collectedAmount = collectedByPerson.get(row.name.trim()) ?? 0;
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
