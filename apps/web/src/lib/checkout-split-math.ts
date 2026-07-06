import { eurosToCents, centsToEuros } from '@/lib/money-allocation';
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

/** Per-row obligation after bill-level discount (round each row; no second allocation). */
export function discountedObligationAmount(
  preDiscountAmount: number,
  discountRate: number,
): number {
  const factor = 1 - clampCheckoutDiscountRate(discountRate) / 100;
  return centsToEuros(Math.round(eurosToCents(Number(preDiscountAmount) * factor)));
}

export function applyDiscountToRows(rows: SplitResult[], discountRate: number): SplitResult[] {
  return rows.map((row) => ({
    ...row,
    amount: discountedObligationAmount(row.amount, discountRate),
  }));
}

export function discountedSplitRows(split: BillSplit, discountRate: number): SplitResult[] {
  return applyDiscountToRows(normalizeSplitRows(split), discountRate);
}

export function sumSplitRowAmounts(rows: SplitResult[]): number {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

/** Summary bar「应收」: round whole consumption after discount. */
export function checkoutPayableAmount(split: BillSplit, discountRate: number): number {
  const factor = 1 - clampCheckoutDiscountRate(discountRate) / 100;
  return centsToEuros(Math.round(eurosToCents(Number(split.total_amount) * factor)));
}
