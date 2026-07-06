import type { SplitResult } from '@/types';

/**
 * When session ledger exists, preserve existing row order/names per index;
 * update amounts from incoming rows matched by name; append new names at end.
 */
export function mergeSplitResultWithLedger(
  existing: SplitResult[],
  incoming: SplitResult[],
): SplitResult[] {
  if (existing.length === 0) return incoming;
  if (incoming.length === 0) return existing;

  const incomingByName = new Map<string, SplitResult>();
  for (const row of incoming) {
    incomingByName.set(row.name.trim(), row);
  }

  const usedIncoming = new Set<string>();
  const merged: SplitResult[] = existing.map((exRow, index) => {
    const name = exRow.name.trim();
    const match = incomingByName.get(name);
    if (match) {
      usedIncoming.add(name);
      return {
        ...exRow,
        amount: match.amount,
        paid: !!exRow.paid || !!match.paid,
      };
    }
    const atIndex = incoming[index];
    if (atIndex && atIndex.name.trim() === name) {
      usedIncoming.add(name);
      return {
        ...exRow,
        amount: atIndex.amount,
        paid: !!exRow.paid || !!atIndex.paid,
      };
    }
    return exRow;
  });

  for (const row of incoming) {
    const name = row.name.trim();
    if (usedIncoming.has(name)) continue;
    merged.push({ ...row, paid: !!row.paid });
  }

  return merged;
}

/** Merge paid flags by index when no ledger (realtime refresh). */
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
  for (let i = 0; i < len; i += 1) {
    const row = inc[i] ?? ex[i];
    if (!row) continue;
    merged.push({
      ...row,
      paid: !!row.paid || !!ex[i]?.paid,
    });
  }
  return merged;
}
