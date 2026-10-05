import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import {
  buildSplitSettlementRows,
  type SplitSettlementStatus,
} from '@/lib/checkout-split-settlement';
import type { SplitResult } from '@/types';

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
