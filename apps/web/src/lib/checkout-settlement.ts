import { checkoutPayableAmount, normalizeSplitRows } from '@/lib/checkout-split-math';
import {
  outstandingAmount,
  totalCollectedAmount,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
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
  const pending = Math.max(0, Math.round((payable - collected) * 100) / 100);
  return {
    consumption: Number(request.total_amount),
    payable,
    discountRate,
    collected,
    pending,
  };
}

export function checkoutPaymentProgress(request: BillSplit): {
  paidCount: number;
  totalCount: number;
} {
  const rows = normalizeSplitRows(request);
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

/** Amount to confirm for one split row (never negative). */
export function checkoutRowCollectAmount(
  rowAmount: number,
  priorCollectedForPerson: number,
): number {
  return outstandingAmount(rowAmount, priorCollectedForPerson);
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
      person_name: row.person_name,
      amount: row.amount,
      created_at: row.created_at,
    });
    map.set(row.session_id, list);
  }
  return map;
}
