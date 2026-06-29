import { normalizeSplitRows } from '@/lib/checkout-split-math';
import type { BillSplit, SplitResult } from '@/types';

export type SplitRowWithIndex = {
  row: SplitResult;
  index: number;
};

/** Split rows still awaiting confirm-payment; preserves original person_index for RPC. */
export function unpaidSplitRowsWithIndex(rows: SplitResult[]): SplitRowWithIndex[] {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.paid);
}

export type SessionCollectedPayment = {
  id: string;
  person_name: string;
  amount: number;
  created_at: string;
};

export function sumCollectedByPersonName(
  payments: SessionCollectedPayment[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const payment of payments) {
    const name = payment.person_name.trim();
    if (!name) continue;
    map.set(name, (map.get(name) ?? 0) + Number(payment.amount));
  }
  return map;
}

export function totalCollectedAmount(payments: SessionCollectedPayment[]): number {
  return payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
}

/** New payable minus prior collections for this person (never negative). */
export function suggestedCollectionAmount(
  personName: string,
  newPayable: number,
  collectedByPerson: Map<string, number>,
): number {
  const prior = collectedByPerson.get(personName.trim()) ?? 0;
  const delta = Number(newPayable) - prior;
  return Math.max(0, Math.round(delta * 100) / 100);
}

export function isWholeTableSplit(split: BillSplit): boolean {
  return normalizeSplitRows(split).length <= 1;
}

export function hasConfirmedPerson(split: BillSplit): boolean {
  return (split.result || []).some((row) => !!row.paid);
}

export type ResumeCheckoutBlockReason = 'whole_table_paid';

export type ResumeOrderingConfirmVariant =
  | 'preserve_by_item'
  | 'preserve_with_collections'
  | 'cancel_no_collections';

/** Confirm-dialog copy branch; must match resume_table_session_ordering split fate. */
export function resumeOrderingConfirmVariant(
  split: BillSplit,
  collectedPayments: SessionCollectedPayment[],
): ResumeOrderingConfirmVariant {
  if (split.split_mode === 'by_item') return 'preserve_by_item';
  if (hasConfirmedPerson(split) || collectedPayments.length > 0) {
    return 'preserve_with_collections';
  }
  return 'cancel_no_collections';
}

export function resumeCheckoutBlockReason(
  split: BillSplit,
  collectedPayments: SessionCollectedPayment[],
): ResumeCheckoutBlockReason | null {
  if (!isWholeTableSplit(split)) return null;
  if (hasConfirmedPerson(split)) return 'whole_table_paid';
  if (collectedPayments.length > 0) return 'whole_table_paid';
  return null;
}

export function httpStatusForResumeOrderingRpcCode(code: string): number {
  const map: Record<string, number> = {
    no_session: 404,
    whole_table_paid: 409,
    resume_failed: 500,
  };
  return map[code] ?? 500;
}
