import type { BillSplit, SplitResult } from '@/types';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';

export type ConfirmPaymentClientOutcome = {
  all_paid: boolean;
  result: SplitResult[];
  final_amount: number;
  collection: SessionCollectedPayment | null;
};

export function appendCollectedPayment(
  prev: SessionCollectedPayment[],
  payment: SessionCollectedPayment,
): SessionCollectedPayment[] {
  if (prev.some((row) => row.id === payment.id)) return prev;
  return [...prev, payment];
}

export function appendCollectedPaymentToSessionMap(
  prev: Map<string, SessionCollectedPayment[]>,
  sessionId: string,
  payment: SessionCollectedPayment,
): Map<string, SessionCollectedPayment[]> {
  const next = new Map(prev);
  next.set(sessionId, appendCollectedPayment(prev.get(sessionId) ?? [], payment));
  return next;
}

export function applyConfirmPaymentToRequests(
  prev: BillSplit[],
  billSplitId: string,
  outcome: Pick<ConfirmPaymentClientOutcome, 'all_paid' | 'result'>,
): BillSplit[] {
  if (outcome.all_paid) {
    return prev.filter((row) => row.id !== billSplitId);
  }
  return prev.map((row) =>
    row.id === billSplitId ? { ...row, result: outcome.result } : row,
  );
}

/** Keep optimistic ledger rows until the server reload includes the same payment id. */
export function mergeCollectedLedgersBySession(
  authoritative: Map<string, SessionCollectedPayment[]>,
  optimistic: Map<string, SessionCollectedPayment[]>,
): Map<string, SessionCollectedPayment[]> {
  const next = new Map(authoritative);
  optimistic.forEach((payments, sessionId) => {
    const merged = [...(next.get(sessionId) ?? [])];
    for (const payment of payments) {
      if (merged.some((row) => row.id === payment.id)) continue;
      merged.push(payment);
    }
    merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
    next.set(sessionId, merged);
  });
  return next;
}
