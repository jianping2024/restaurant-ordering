import { sumBillableSessionTotal } from '@/lib/billable-session-lines';
import { checkoutPayableAmount } from '@/lib/checkout-split-math';
import {
  outstandingAmount,
  totalCollectedAmount,
  hasConfirmedPerson,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import type { BillSplit, Order, SplitMode } from '@/types';

export type CheckoutSettlementSummary = {
  consumption: number;
  payable: number;
  discountRate: number;
  collected: number;
  pending: number;
};

/** Sole summary「待收」:折后应收 − 已收台账. Person collect uses obligation − prior only. */
export function buildCheckoutSettlementSummary(
  request: BillSplit,
  discountRate: number,
  collectedPayments: SessionCollectedPayment[],
): CheckoutSettlementSummary {
  const payable = checkoutPayableAmount(request, discountRate);
  const collected = totalCollectedAmount(collectedPayments);
  return {
    consumption: Number(request.total_amount),
    payable,
    discountRate,
    collected,
    pending: outstandingAmount(payable, collected),
  };
}

/**
 * Uncollected (尚欠) for one live open|billing session — sole dashboard「未收」basis.
 * Active `requested` bill_split → same pending as checkout queue
 * (`buildCheckoutSettlementSummary.pending`); else billable − ledger collected.
 */
export function liveSessionUncollectedAmount(params: {
  orders: Order[];
  billSplit: BillSplit | null | undefined;
  collectedPayments: SessionCollectedPayment[];
}): number {
  const { orders, billSplit, collectedPayments } = params;
  if (billSplit?.status === 'requested') {
    return buildCheckoutSettlementSummary(
      billSplit,
      billSplit.discount_rate ?? 0,
      collectedPayments,
    ).pending;
  }
  return outstandingAmount(
    sumBillableSessionTotal(orders),
    totalCollectedAmount(collectedPayments),
  );
}

/**
 * Sole checkout-queue collection progress label: bill「已收 / 应收」from the same
 * summary as SettlementBar. Never person-count N/N (that lied when the by-item pool
 * was still open). Null until something is collected.
 */
export function formatCheckoutBillCollectionProgressLabel(
  summary: Pick<CheckoutSettlementSummary, 'collected' | 'payable'>,
  template: string,
): string | null {
  if (summary.collected <= 0) return null;
  return template
    .replace('{collected}', summary.collected.toFixed(2))
    .replace('{payable}', summary.payable.toFixed(2));
}

export function hasCheckoutCollections(
  request: BillSplit,
  collectedPayments: SessionCollectedPayment[],
): boolean {
  if (collectedPayments.length > 0) return true;
  return hasConfirmedPerson(request);
}

export function checkoutSplitModeLabel(
  splitMode: SplitMode | string | null | undefined,
  labels: { even: string; byItem: string; custom: string; wholeTable: string },
): string {
  if (splitMode === 'whole_table') return labels.wholeTable;
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
      payment_method: row.payment_method,
      payment_lines: row.payment_lines ?? null,
    });
    map.set(row.session_id, list);
  }
  return map;
}
