import type { SplitMode } from '@/types';

const AMOUNT_EPS = 0.009;

export type BillSplitValidationIssue = 'unassigned_items' | 'amount_mismatch';

function amountsMatch(
  splitMode: SplitMode,
  splitSum: number,
  total: number,
  results: Array<{ amount: number }>,
): boolean {
  if (!Number.isFinite(splitSum) || !Number.isFinite(total)) return false;
  if (splitMode === 'even') {
    if (results.length === 0) return false;
    const ints = results.map((row) => Math.floor(Number(row.amount || 0)));
    return ints.every((n) => n === ints[0]);
  }
  return Math.abs(splitSum - total) <= AMOUNT_EPS;
}

export function validateBillSplit(params: {
  splitMode: SplitMode | null;
  total: number;
  results: Array<{ amount: number }>;
  itemKeys?: string[];
  byItemAssign?: Record<string, string[]>;
  customAmounts?: Array<{ amount: number }>;
}): { ok: true } | { ok: false; issue: BillSplitValidationIssue } {
  const { splitMode, total, results, itemKeys, byItemAssign, customAmounts } = params;

  if (!splitMode) return { ok: true };

  if (splitMode === 'by_item') {
    const keys = itemKeys ?? [];
    const hasUnassigned = keys.some((key) => !(byItemAssign?.[key]?.length));
    if (hasUnassigned) return { ok: false, issue: 'unassigned_items' };
  }

  if (splitMode === 'custom' && customAmounts?.length) {
    if (customAmounts.some((row) => row.amount < -AMOUNT_EPS)) {
      return { ok: false, issue: 'amount_mismatch' };
    }
    if (customAmounts.length > 1) {
      const manualTotal = customAmounts.slice(0, -1).reduce((sum, row) => sum + row.amount, 0);
      if (manualTotal - total > AMOUNT_EPS) {
        return { ok: false, issue: 'amount_mismatch' };
      }
    }
  }

  const splitSum = results.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  if (!amountsMatch(splitMode, splitSum, total, results)) {
    return { ok: false, issue: 'amount_mismatch' };
  }

  return { ok: true };
}
