import { eurosToCents } from '@/lib/money-allocation';
import type { SplitMode } from '@/types';
import {
  getByItemLineStatusFromShares,
  isByItemLineComplete,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';

export type BillSplitValidationIssue =
  | 'unassigned_items'
  | 'incomplete_qty'
  | 'amount_mismatch';

function amountsMatch(
  splitSumCents: number,
  totalCents: number,
): boolean {
  return splitSumCents === totalCents;
}

export function validateBillSplit(params: {
  splitMode: SplitMode | null;
  total: number;
  results: Array<{ amount: number }>;
  itemLines?: Array<{ key: string; qty: number }>;
  lineSpecs?: ByItemLineSpec[];
  byItemAllocations?: ByItemLineAllocation;
  customAmounts?: Array<{ amount: number }>;
}): { ok: true } | { ok: false; issue: BillSplitValidationIssue } {
  const { splitMode, total, results, itemLines, lineSpecs, byItemAllocations, customAmounts } = params;

  if (!splitMode) return { ok: true };

  const specs = lineSpecs ?? itemLines?.map((line) => ({
    mode: 'menu' as const,
    key: line.key,
    lineQty: line.qty,
    lineTotal: 0,
    unitPrice: 0,
  }));

  if (splitMode === 'by_item' && specs) {
    for (const spec of specs) {
      const shares = byItemAllocations?.[spec.key] || [];
      const status = getByItemLineStatusFromShares(spec, shares);
      if (status.kind === 'empty' || status.kind === 'buffet_empty') {
        return { ok: false, issue: 'unassigned_items' };
      }
      if (!isByItemLineComplete(status)) {
        return { ok: false, issue: 'incomplete_qty' };
      }
    }
  }

  if (splitMode === 'custom' && customAmounts?.length) {
    const totalCents = eurosToCents(total);
    if (customAmounts.some((row) => eurosToCents(row.amount) < 0)) {
      return { ok: false, issue: 'amount_mismatch' };
    }
    if (customAmounts.length > 1) {
      const manualCents = customAmounts
        .slice(0, -1)
        .reduce((sum, row) => sum + eurosToCents(row.amount), 0);
      if (manualCents > totalCents) {
        return { ok: false, issue: 'amount_mismatch' };
      }
    }
  }

  const splitSumCents = results.reduce(
    (sum, row) => sum + eurosToCents(Number(row.amount || 0)),
    0,
  );
  if (!amountsMatch(splitSumCents, eurosToCents(total))) {
    return { ok: false, issue: 'amount_mismatch' };
  }

  return { ok: true };
}
