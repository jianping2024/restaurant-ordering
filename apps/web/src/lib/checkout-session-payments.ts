import { normalizeSplitRows } from '@/lib/checkout-split-math';
import type { BillSplit, SplitResult } from '@/types';

export type SplitRowWithIndex = {
  row: SplitResult;
  index: number;
};

/** Obligation minus prior collections for this person (never negative). */
export function outstandingAmount(obligation: number, priorCollected: number): number {
  const delta = Number(obligation) - priorCollected;
  return Math.max(0, Math.round(delta * 100) / 100);
}

/** Split rows with a positive balance after session ledger; preserves person_index for RPC. */
export function collectibleSplitRowsWithIndex(
  rows: SplitResult[],
  collectedByPerson: Map<string, number>,
): SplitRowWithIndex[] {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) =>
        outstandingAmount(row.amount, collectedByPerson.get(row.name.trim()) ?? 0) > 0,
    );
}

export type SessionCollectedPayment = {
  id: string;
  person_name: string;
  amount: number;
  created_at: string;
};

export const SESSION_COLLECTED_PAYMENT_SELECT =
  'id, session_id, person_name, amount, created_at' as const;

export function parseSessionCollectedPayments(
  data: Array<{
    id: unknown;
    session_id?: unknown;
    person_name: unknown;
    amount: unknown;
    created_at: unknown;
  }> | null,
): SessionCollectedPayment[] {
  return (data ?? []).map((row) => ({
    id: row.id as string,
    person_name: row.person_name as string,
    amount: Number(row.amount),
    created_at: row.created_at as string,
  }));
}

export function parseSessionCollectedPaymentsWithSession(
  data: Array<{
    id: unknown;
    session_id: unknown;
    person_name: unknown;
    amount: unknown;
    created_at: unknown;
  }> | null,
): Array<SessionCollectedPayment & { session_id: string }> {
  return (data ?? []).map((row) => ({
    id: row.id as string,
    session_id: row.session_id as string,
    person_name: row.person_name as string,
    amount: Number(row.amount),
    created_at: row.created_at as string,
  }));
}

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
  return outstandingAmount(newPayable, collectedByPerson.get(personName.trim()) ?? 0);
}

/** Derive paid flags from ledger vs row amounts (matches reconcile_split_result_paid_from_ledger). */
export function reconcileSplitResultPaid(
  rows: SplitResult[],
  collectedByPerson: Map<string, number>,
): SplitResult[] {
  return rows.map((row) => ({
    ...row,
    paid: outstandingAmount(row.amount, collectedByPerson.get(row.name.trim()) ?? 0) <= 0,
  }));
}

/** Person names that already have ledger rows (case-insensitive). */
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

/** Distinct display names from ledger rows (preserves first-seen casing). */
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
