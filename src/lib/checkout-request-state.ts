import type { BillSplit, SplitResult } from '@/types';

/** Keep paid flags when a stale realtime refresh returns older rows. */
export function mergeSplitResultPaid(
  incoming: SplitResult[] | undefined,
  existing: SplitResult[] | undefined,
): SplitResult[] {
  const inc = incoming ?? [];
  const ex = existing ?? [];
  if (ex.length === 0) return inc;
  if (inc.length === 0) return ex;
  const len = Math.max(inc.length, ex.length);
  const merged: SplitResult[] = [];
  for (let i = 0; i < len; i++) {
    const row = inc[i] ?? ex[i];
    if (!row) continue;
    merged.push({
      ...row,
      paid: !!row.paid || !!ex[i]?.paid,
    });
  }
  return merged;
}

/** Merge server list into local checkout queue without losing confirmed paid state. */
export function mergeBillSplitsFromRefresh(
  prev: BillSplit[],
  incoming: BillSplit[],
): BillSplit[] {
  const prevById = new Map(prev.map((r) => [r.id, r]));
  return incoming.map((row) => {
    const old = prevById.get(row.id);
    if (!old?.result?.length) return row;
    return {
      ...row,
      result: mergeSplitResultPaid(row.result, old.result),
    };
  });
}

export function checkoutPersonKey(billSplitId: string, rowIndex: number): string {
  return `${billSplitId}-${rowIndex}`;
}

export function isCheckoutRequestBusy(processingKeys: ReadonlySet<string>, billSplitId: string): boolean {
  const prefix = `${billSplitId}-`;
  for (const key of processingKeys) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
}
