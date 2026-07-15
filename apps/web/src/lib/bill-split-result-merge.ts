import {
  resolveSplitPersonDisplayName,
  splitPersonKey,
} from '@/lib/split-person-identity';
import type { SplitResult } from '@/types';

function incomingByPersonKey(rows: SplitResult[]): Map<string, SplitResult> {
  const map = new Map<string, SplitResult>();
  for (const row of rows) {
    const key = splitPersonKey(row.name);
    if (!key) continue;
    map.set(key, row);
  }
  return map;
}

/**
 * By-item continuation: incoming obligations are authoritative (recomputed from
 * allocations). Preserve existing row order/index for ledger; drop stale rows.
 */
export function mergeByItemSplitResultWithLedger(
  existing: SplitResult[],
  incoming: SplitResult[],
): SplitResult[] {
  if (incoming.length === 0) return existing;
  if (existing.length === 0) return incoming;

  const byKey = incomingByPersonKey(incoming);
  const usedKeys = new Set<string>();
  const merged: SplitResult[] = [];

  for (const exRow of existing) {
    const key = splitPersonKey(exRow.name);
    if (!key) continue;
    const match = byKey.get(key);
    if (!match) continue;
    usedKeys.add(key);
    merged.push({
      name: resolveSplitPersonDisplayName(exRow.name, match.name),
      amount: match.amount,
      paid: !!exRow.paid || !!match.paid,
    });
  }

  for (const row of incoming) {
    const key = splitPersonKey(row.name);
    if (!key || usedKeys.has(key)) continue;
    usedKeys.add(key);
    merged.push({
      name: resolveSplitPersonDisplayName(undefined, row.name),
      amount: row.amount,
      paid: !!row.paid,
    });
  }

  return merged;
}

/**
 * Even/custom continuation with ledger: preserve row shape; update amounts by
 * person key (case-insensitive).
 */
export function mergeSplitResultWithLedger(
  existing: SplitResult[],
  incoming: SplitResult[],
): SplitResult[] {
  if (existing.length === 0) return incoming;
  if (incoming.length === 0) return existing;

  const byKey = incomingByPersonKey(incoming);
  const usedKeys = new Set<string>();
  const merged: SplitResult[] = existing.map((exRow, index) => {
    const key = splitPersonKey(exRow.name);
    const match = key ? byKey.get(key) : undefined;
    if (match && key) {
      usedKeys.add(key);
      return {
        ...exRow,
        amount: match.amount,
        paid: !!exRow.paid || !!match.paid,
      };
    }
    const atIndex = incoming[index];
    const indexKey = atIndex ? splitPersonKey(atIndex.name) : '';
    if (atIndex && indexKey && indexKey === key) {
      usedKeys.add(indexKey);
      return {
        ...exRow,
        amount: atIndex.amount,
        paid: !!exRow.paid || !!atIndex.paid,
      };
    }
    return exRow;
  });

  for (const row of incoming) {
    const key = splitPersonKey(row.name);
    if (!key || usedKeys.has(key)) continue;
    usedKeys.add(key);
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
