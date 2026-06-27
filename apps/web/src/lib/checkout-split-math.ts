import type { BillSplit, SplitResult } from '@/types';

export function normalizeSplitRows(split: BillSplit): SplitResult[] {
  const rows = (split.result || []) as SplitResult[];
  if (rows.length > 0) return rows;
  if (split.total_amount > 0) {
    return [{ name: 'Total', amount: Number(split.total_amount) }];
  }
  return [];
}

export function clampCheckoutDiscountRate(discountRate: number): number {
  return Math.min(100, Math.max(0, discountRate));
}

export function applyDiscountToRows(rows: SplitResult[], discountRate: number): SplitResult[] {
  const factor = 1 - clampCheckoutDiscountRate(discountRate) / 100;
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount) * factor,
  }));
}

export function discountedSplitRows(split: BillSplit, discountRate: number): SplitResult[] {
  return applyDiscountToRows(normalizeSplitRows(split), discountRate);
}

export function sumSplitRowAmounts(rows: SplitResult[]): number {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

/** Payable total after discount — matches checkout dashboard「应收」. */
export function checkoutPayableAmount(split: BillSplit, discountRate: number): number {
  return Math.max(0, sumSplitRowAmounts(discountedSplitRows(split, discountRate)));
}
