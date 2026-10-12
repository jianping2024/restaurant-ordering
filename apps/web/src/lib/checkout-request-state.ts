import type { BillSplit } from '@/types';
import {
  mergeByItemSplitResultWithLedger,
  mergeSplitResultPaid,
} from '@/lib/bill-split-result-merge';

export { mergeSplitResultPaid } from '@/lib/bill-split-result-merge';

const checkoutRequestKeyPrefix = (billSplitId: string) => `${billSplitId}:`;

/** Merge server list into local checkout queue without losing confirmed paid state. */
export function mergeBillSplitsFromRefresh(
  prev: BillSplit[],
  incoming: BillSplit[],
): BillSplit[] {
  const prevById = new Map(prev.map((r) => [r.id, r]));
  return incoming.map((row) => {
    const old = prevById.get(row.id);
    if (!old?.result?.length) return row;
    // By-item: party_id-first merge — unpaid tickets dropped on server stay dropped;
    // paid omitted tickets keep ledger amounts. Other modes: index paid-flag only.
    const result =
      row.split_mode === 'by_item'
        ? mergeByItemSplitResultWithLedger(old.result, row.result ?? [])
        : mergeSplitResultPaid(row.result, old.result);
    return { ...row, result };
  });
}

export function checkoutPersonKey(billSplitId: string, rowIndex: number): string {
  return `${checkoutRequestKeyPrefix(billSplitId)}payment:${rowIndex}`;
}

export function checkoutResumeOrderingKey(billSplitId: string): string {
  return `${checkoutRequestKeyPrefix(billSplitId)}resume`;
}

/** True while any in-flight mutation targets this checkout request row. */
export function isCheckoutDetailLocked(
  processingKeys: ReadonlySet<string>,
  billSplitId: string,
): boolean {
  const prefix = checkoutRequestKeyPrefix(billSplitId);
  let locked = false;
  processingKeys.forEach((key) => {
    if (key.startsWith(prefix)) locked = true;
  });
  return locked;
}
