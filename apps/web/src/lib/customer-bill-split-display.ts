import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import {
  buildSplitSettlementRows,
  type SplitSettlementStatus,
} from '@/lib/checkout-split-settlement';
import { centsToEuros, eurosToCents } from '@/lib/money-allocation';
import type { SplitResult } from '@/types';

export type CustomerSplitRowDisplay = {
  name: string;
  obligationAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  settlementStatus: SplitSettlementStatus;
  /** By-item table view only: this phone's own ticket. */
  mine?: boolean;
  /** By-item table view only: split ticket key (party_id first). */
  ticketKey?: string;
  /** By-item table view only: ticket call time (ISO); missing = oldest. */
  calledAt?: string;
};

/** Customer bill: obligation from split result, collection state from session ledger. */
export function buildCustomerSplitDisplayRows(
  resultRows: SplitResult[],
  collectedPayments: SessionCollectedPayment[],
  discountRate = 0,
  billTotalAmount?: number,
): CustomerSplitRowDisplay[] {
  return buildSplitSettlementRows(
    resultRows,
    collectedPayments,
    discountRate,
    billTotalAmount,
  ).map(
    ({ name, obligationAmount, collectedAmount, outstandingAmount, settlementStatus }) => ({
      name,
      obligationAmount,
      collectedAmount,
      outstandingAmount,
      settlementStatus,
    }),
  );
}

export type CustomerTableSettlementSummary = {
  /** Whole billable table. */
  table: number;
  /** Money the ledger already collected on called tickets. */
  collected: number;
  /** Called tickets still to collect. */
  called: number;
  /** Dishes nobody has called for yet: table − Σ called obligations (floor 0). */
  unclaimed: number;
};

/** By-item whole-table split of one bill: collected + called + unclaimed = table. */
export function buildCustomerTableSettlementSummary(
  rows: ReadonlyArray<Pick<CustomerSplitRowDisplay, 'obligationAmount' | 'outstandingAmount'>>,
  tableTotal: number,
): CustomerTableSettlementSummary {
  let obligationCents = 0;
  let outstandingCents = 0;
  for (const row of rows) {
    obligationCents += eurosToCents(row.obligationAmount);
    outstandingCents += eurosToCents(row.outstandingAmount);
  }
  return {
    table: tableTotal,
    collected: centsToEuros(obligationCents - outstandingCents),
    called: centsToEuros(outstandingCents),
    unclaimed: centsToEuros(Math.max(0, eurosToCents(tableTotal) - obligationCents)),
  };
}

/**
 * By-item table view order: this phone's unpaid ticket first, then other unpaid tickets, then
 * settled ones last; inside each band the latest call first (earliest call at the bottom).
 */
export function orderCustomerTableSplitRows<T extends CustomerSplitRowDisplay>(rows: T[]): T[] {
  const band = (row: T) =>
    row.settlementStatus === 'settled' ? 2 : row.mine ? 0 : 1;
  const calledMs = (row: T) => (row.calledAt ? Date.parse(row.calledAt) || 0 : 0);
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        band(a.row) - band(b.row) ||
        calledMs(b.row) - calledMs(a.row) ||
        a.index - b.index,
    )
    .map(({ row }) => row);
}
