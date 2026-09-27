import { eurosToCents } from '@/lib/money-allocation';
import type { SplitMode } from '@/types';
import {
  getByItemLineStatusFromRows,
  getByItemLineStatusFromShares,
  isByItemLineComplete,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';

export type BillSplitValidationIssue =
  | 'unassigned_items'
  | 'incomplete_qty'
  | 'amount_mismatch';

export type BillSplitValidation =
  | { ok: true }
  | { ok: false; issue: BillSplitValidationIssue };

/**
 * Sole whole-draft validation for editable by-item rows.
 * It deliberately runs before rows are serialized into shares, because parsing
 * drops incomplete rows and therefore cannot preserve editing errors.
 */
export function validateByItemDraftRows(params: {
  lineSpecs: ByItemLineSpec[];
  rowsByKey: Record<string, ByItemConsumerRow[]>;
  allowPartialByItem?: boolean;
}): BillSplitValidation {
  for (const spec of params.lineSpecs) {
    const status = getByItemLineStatusFromRows(params.rowsByKey[spec.key] ?? [], spec);
    if (status.kind === 'complete') continue;
    if (params.allowPartialByItem && (
      status.kind === 'empty'
      || status.kind === 'buffet_empty'
      || status.kind === 'short'
      || status.kind === 'buffet_short'
    )) {
      continue;
    }
    if (status.kind === 'empty' || status.kind === 'buffet_empty') {
      return { ok: false, issue: 'unassigned_items' };
    }
    return { ok: false, issue: 'incomplete_qty' };
  }
  return { ok: true };
}

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
  /** Staff per-person collect: allow an unfinished by-item pool. Guest stays strict. */
  allowPartialByItem?: boolean;
  /**
   * Staff floor reopen of a preserved active plan after resume-ordering.
   * Allows unfinished by-item pool + skips amount==total (new dishes after resume).
   * Guest must never set this.
   */
  staffReopenActivePlan?: boolean;
}): BillSplitValidation {
  const {
    splitMode,
    total,
    results,
    itemLines,
    lineSpecs,
    byItemAllocations,
    customAmounts,
    allowPartialByItem = false,
    staffReopenActivePlan = false,
  } = params;

  const relaxByItemPool = allowPartialByItem || staffReopenActivePlan;

  if (!splitMode || splitMode === 'whole_table') return { ok: true };

  if (splitMode === 'custom' && results.length < 1) {
    return { ok: false, issue: 'amount_mismatch' };
  }

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
      if (status.kind === 'over' || status.kind === 'buffet_over') {
        return { ok: false, issue: 'incomplete_qty' };
      }
      if (!relaxByItemPool) {
        if (status.kind === 'empty' || status.kind === 'buffet_empty') {
          return { ok: false, issue: 'unassigned_items' };
        }
        if (!isByItemLineComplete(status)) {
          return { ok: false, issue: 'incomplete_qty' };
        }
      }
    }
  }

  if (splitMode === 'custom' && customAmounts?.length) {
    if (customAmounts.some((row) => eurosToCents(row.amount) < 0)) {
      return { ok: false, issue: 'amount_mismatch' };
    }
  }

  const splitSumCents = results.reduce(
    (sum, row) => sum + eurosToCents(Number(row.amount || 0)),
    0,
  );
  const skipTotalMatch =
    staffReopenActivePlan || (allowPartialByItem && splitMode === 'by_item');
  if (!skipTotalMatch && !amountsMatch(splitSumCents, eurosToCents(total))) {
    return { ok: false, issue: 'amount_mismatch' };
  }

  return { ok: true };
}
