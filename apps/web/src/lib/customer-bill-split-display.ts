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
