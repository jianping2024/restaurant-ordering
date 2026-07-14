import { discountedObligationAmount } from '@/lib/checkout-split-math';
import {
  buildSplitSettlementRows,
  pendingSplitSettlementRows,
} from '@/lib/checkout-split-settlement';
import { eurosToCents } from '@/lib/money-allocation';
import type { BillSplit, SplitResult } from '@/types';

export type SplitRowWithIndex = {
  row: SplitResult;
  index: number;
};

/** Obligation minus prior collections for this index (never negative, cent exact). */
export function outstandingAmount(obligation: number, priorCollected: number): number {
  return Math.max(0, eurosToCents(obligation) - eurosToCents(priorCollected)) / 100;
}

export function isSplitRowCollectible(
  discountedObligation: number,
  collectedByIndex: Map<number, number>,
  rowIndex: number,
): boolean {
  return outstandingAmount(discountedObligation, collectedByIndex.get(rowIndex) ?? 0) > 0;
}

/** @deprecated Prefer pendingSplitSettlementRows from checkout-split-settlement. */
export function collectibleSplitRowsWithIndex(
  rows: SplitResult[],
  collectedByIndex: Map<number, number>,
): SplitRowWithIndex[] {
  const payments: SessionCollectedPayment[] = [];
  collectedByIndex.forEach((amount, index) => {
    if (amount <= 0) return;
    payments.push({
      id: `legacy-${index}`,
      person_index: index,
      person_name: rows[index]?.name ?? '',
      amount,
      created_at: '',
    });
  });
  return pendingSplitSettlementRows(buildSplitSettlementRows(rows, payments)).map((row) => ({
    row: rows[row.index] ?? { name: row.name, amount: row.obligationAmount },
    index: row.index,
  }));
}

export type SessionCollectedPayment = {
  id: string;
  person_index: number | null;
  person_name: string;
  amount: number;
  created_at: string;
};

export const SESSION_COLLECTED_PAYMENT_SELECT =
  'id, session_id, person_index, person_name, amount, created_at' as const;

export function parseSessionCollectedPayments(
  data: Array<{
    id: unknown;
    session_id?: unknown;
    person_index?: unknown;
    person_name: unknown;
    amount: unknown;
    created_at: unknown;
  }> | null,
): SessionCollectedPayment[] {
  return (data ?? []).map((row) => ({
    id: row.id as string,
    person_index:
      typeof row.person_index === 'number' && Number.isInteger(row.person_index)
        ? row.person_index
        : null,
    person_name: row.person_name as string,
    amount: Number(row.amount),
    created_at: row.created_at as string,
  }));
}

export function parseSessionCollectedPaymentsWithSession(
  data: Array<{
    id: unknown;
    session_id: unknown;
    person_index?: unknown;
    person_name: unknown;
    amount: unknown;
    created_at: unknown;
  }> | null,
): Array<SessionCollectedPayment & { session_id: string }> {
  return (data ?? []).map((row) => ({
    id: row.id as string,
    session_id: row.session_id as string,
    person_index:
      typeof row.person_index === 'number' && Number.isInteger(row.person_index)
        ? row.person_index
        : null,
    person_name: row.person_name as string,
    amount: Number(row.amount),
    created_at: row.created_at as string,
  }));
}

export function sumCollectedByPersonIndex(
  payments: SessionCollectedPayment[],
): Map<number, number> {
  const map = new Map<number, number>();
  for (const payment of payments) {
    if (payment.person_index == null || payment.person_index < 0) continue;
    const prior = map.get(payment.person_index) ?? 0;
    map.set(payment.person_index, prior + Number(payment.amount));
  }
  return map;
}

/** @deprecated Ledger matches by person_index; kept for customer display fallbacks. */
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

export function suggestedCollectionAmount(
  rowIndex: number,
  discountedObligation: number,
  collectedByIndex: Map<number, number>,
): number {
  return outstandingAmount(discountedObligation, collectedByIndex.get(rowIndex) ?? 0);
}

export function reconcileSplitResultPaid(
  rows: SplitResult[],
  collectedByIndex: Map<number, number>,
): SplitResult[] {
  return rows.map((row, index) => ({
    ...row,
    paid: !isSplitRowCollectible(row.amount, collectedByIndex, index),
  }));
}

export function collectedPersonNames(
  payments: SessionCollectedPayment[],
): ReadonlySet<string> {
  const names = new Set<string>();
  for (const payment of payments) {
    const key = payment.person_name.trim().toLowerCase();
    if (key) names.add(key);
  }
  return names;
}

export function uniqueCollectedPersonNames(
  payments: Array<{ person_name: string }>,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const payment of payments) {
    const name = payment.person_name.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function isWholeTableSplit(split: BillSplit): boolean {
  return (split.result ?? []).length <= 1;
}

export function hasConfirmedPerson(split: BillSplit): boolean {
  return (split.result || []).some((row) => !!row.paid);
}

export type ResumeCheckoutBlockReason = 'whole_table_paid';

export type ResumeOrderingConfirmVariant =
  | 'preserve_by_item'
  | 'preserve_with_collections'
  | 'cancel_no_collections';

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

/** Discounted obligation for one split row (matches RPC). */
export function splitRowDiscountedObligation(
  preDiscountAmount: number,
  discountRate: number,
): number {
  return discountedObligationAmount(preDiscountAmount, discountRate);
}
