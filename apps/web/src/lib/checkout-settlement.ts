import { applyDiscountToRows, checkoutPayableAmount, normalizeSplitRows } from '@/lib/checkout-split-math';
import {
  outstandingAmount,
  totalCollectedAmount,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import {
  buildSplitSettlementRows,
  sumSplitSettlementOutstanding,
} from '@/lib/checkout-split-settlement';
import type { BillSplit, SplitMode } from '@/types';

export type CheckoutSettlementSummary = {
  consumption: number;
  payable: number;
  discountRate: number;
  collected: number;
  pending: number;
};

export function buildCheckoutSettlementSummary(
  request: BillSplit,
  discountRate: number,
  collectedPayments: SessionCollectedPayment[],
): CheckoutSettlementSummary {
  const payable = checkoutPayableAmount(request, discountRate);
  const collected = totalCollectedAmount(collectedPayments);
  const splitRows = normalizeSplitRows(request);
  const pending =
    splitRows.length > 1
      ? sumSplitSettlementOutstanding(
          buildSplitSettlementRows(
            applyDiscountToRows(splitRows, discountRate),
            collectedPayments,
          ),
        )
      : outstandingAmount(payable, collected);
  return {
    consumption: Number(request.total_amount),
    payable,
    discountRate,
    collected,
    pending,
  };
}

export function checkoutPaymentProgress(
  request: BillSplit,
  collectedPayments: SessionCollectedPayment[] = [],
  discountRate = 0,
): {
  paidCount: number;
  totalCount: number;
} {
  const rows = normalizeSplitRows(request);
  if (rows.length > 1 && collectedPayments.length > 0) {
    const settlement = buildSplitSettlementRows(
      applyDiscountToRows(rows, discountRate),
      collectedPayments,
    );
    return {
      paidCount: settlement.filter((row) => row.settlementStatus === 'settled').length,
      totalCount: settlement.length,
    };
  }
  return {
    paidCount: rows.filter((row) => row.paid).length,
    totalCount: rows.length,
  };
}

export function hasCheckoutCollections(
  request: BillSplit,
  collectedPayments: SessionCollectedPayment[],
): boolean {
  if (collectedPayments.length > 0) return true;
  return (request.result ?? []).some((row) => row.paid);
}

export function checkoutSplitModeLabel(
  splitMode: SplitMode | string | null | undefined,
  labels: { even: string; byItem: string; custom: string; wholeTable: string },
): string {
  if (splitMode === 'by_item') return labels.byItem;
  if (splitMode === 'custom') return labels.custom;
  if (splitMode === 'even') return labels.even;
  return labels.wholeTable;
}

export function formatCheckoutWaitDuration(
  createdAt: string,
  labels: { durationJustNow: string; durationMinutes: string },
): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return labels.durationJustNow;
  return labels.durationMinutes.replace('{n}', String(mins));
}

export function groupCollectedPaymentsBySession(
  rows: Array<SessionCollectedPayment & { session_id: string }>,
): Map<string, SessionCollectedPayment[]> {
  const map = new Map<string, SessionCollectedPayment[]>();
  for (const row of rows) {
    const list = map.get(row.session_id) ?? [];
    list.push({
      id: row.id,
      person_index: row.person_index,
      person_name: row.person_name,
      amount: row.amount,
      created_at: row.created_at,
    });
    map.set(row.session_id, list);
  }
  return map;
}
