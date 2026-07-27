import type { OrderHistorySessionSettlement } from '@/lib/order-history/types';

/**
 * Merged source sessions carry no billable orders (moved to target).
 * Ignore orphan ledger rows on the source session — presentation only.
 */
export function buildMergedSourceSessionSettlement(): OrderHistorySessionSettlement {
  return {
    outcome: 'closed_without_billing',
    summary: null,
    showFinancialDetails: false,
    collectedPayments: [],
    listAmount: null,
    listAmountKind: null,
    paidRevenue: null,
    canPrintBill: false,
  };
}
