import { centsToEuros, eurosToCents } from '@/lib/money-allocation';
import {
  outstandingAmount,
  sumCollectedByPersonIndex,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import type { SplitResult } from '@/types';

export type SplitSettlementStatus = 'due' | 'partial' | 'settled';

export type SplitSettlementRow = {
  index: number;
  name: string;
  obligationAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  settlementStatus: SplitSettlementStatus;
};

export function deriveSplitSettlementStatus(
  obligationAmount: number,
  collectedAmount: number,
): SplitSettlementStatus {
  const outstanding = outstandingAmount(obligationAmount, collectedAmount);
  if (outstanding <= 0) return 'settled';
  if (collectedAmount > 0) return 'partial';
  return 'due';
}

/** Per-person settlement from split obligations and session ledger (ledger is authoritative). */
export function buildSplitSettlementRows(
  resultRows: SplitResult[],
  collectedPayments: SessionCollectedPayment[],
): SplitSettlementRow[] {
  const collectedByIndex = sumCollectedByPersonIndex(collectedPayments);
  return resultRows.map((row, index) => {
    const collectedAmount = collectedByIndex.get(index) ?? 0;
    const obligationAmount = row.amount;
    const outstanding = outstandingAmount(obligationAmount, collectedAmount);
    return {
      index,
      name: row.name,
      obligationAmount,
      collectedAmount,
      outstandingAmount: outstanding,
      settlementStatus: deriveSplitSettlementStatus(obligationAmount, collectedAmount),
    };
  });
}

export function sumSplitSettlementOutstanding(rows: SplitSettlementRow[]): number {
  const cents = rows.reduce((sum, row) => sum + eurosToCents(row.outstandingAmount), 0);
  return centsToEuros(cents);
}

/** Amount shown for one row (outstanding when partially collected). */
export function splitSettlementCollectAmount(row: SplitSettlementRow): number {
  return row.settlementStatus === 'partial' ? row.outstandingAmount : row.obligationAmount;
}

export function pendingSplitSettlementRows(rows: SplitSettlementRow[]): SplitSettlementRow[] {
  return rows.filter((row) => row.settlementStatus !== 'settled');
}

/** Matches RPC should_print_split: only multi-person splits get per-person receipts. */
export function isMultiPersonSplitBill(request: { result?: SplitResult[] | null }): boolean {
  return (request.result?.length ?? 0) > 1;
}
