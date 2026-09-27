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

/** Per-row obligation after bill-level discount — must match SQL `checkout_round_discount_amount`. */
export function discountedObligationAmount(
  preDiscountAmount: number,
  discountRate: number,
): number {
  const factor = 1 - clampCheckoutDiscountRate(discountRate) / 100;
  // Cents-first then round: avoids float (19.95×0.9→17.955→JS 17.95 vs PG round 17.96).
  return centsToEuros(Math.round(eurosToCents(Number(preDiscountAmount)) * factor));
}

export function applyDiscountToRows(rows: SplitResult[], discountRate: number): SplitResult[] {
  return rows.map((row) => ({
    ...row,
    amount: discountedObligationAmount(row.amount, discountRate),
  }));
}

export function sumSplitRowAmounts(rows: SplitResult[]): number {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

/** Summary bar「应收」— must match SQL `checkout_payable_from_total`. */
export function checkoutPayableAmount(split: BillSplit, discountRate: number): number {
  const factor = 1 - clampCheckoutDiscountRate(discountRate) / 100;
  return centsToEuros(Math.round(eurosToCents(Number(split.total_amount)) * factor));
}

/**
 * Sole money view under bill-level % discount (bar / person chip / collect hint).
 * payable = discountedObligation; saved = pre − payable (cents-safe).
 */
export function resolveCheckoutDiscountMoneyView(
  preAmount: number,
  discountRate: number,
): {
  rate: number;
  preAmount: number;
  payableAmount: number;
  savedAmount: number;
  active: boolean;
} {
  const rate = clampCheckoutDiscountRate(discountRate);
  const pre = Number(preAmount);
  const payableAmount = discountedObligationAmount(pre, rate);
  const savedAmount = centsToEuros(eurosToCents(pre) - eurosToCents(payableAmount));
  return {
    rate,
    preAmount: centsToEuros(eurosToCents(pre)),
    payableAmount,
    savedAmount,
    active: rate > 0 && savedAmount > 0,
  };
}

/** Sole「折扣 n% −€x」label (`settlementDiscount` with `{n}` + `{amount}`). */
export function formatCheckoutDiscountLabel(
  template: string,
  rate: number,
  savedAmount: number,
): string {
  return template
    .replace('{n}', String(clampCheckoutDiscountRate(rate)))
    .replace('{amount}', savedAmount.toFixed(2));
}

/** Sole person-share display: primary = 折后; optional muted 折前 when discount active. */
export function resolveCheckoutDiscountedShareDisplay(
  preAmount: number,
  discountRate: number,
): { displayAmount: number; preAmount: number; showPreLine: boolean } {
  const view = resolveCheckoutDiscountMoneyView(preAmount, discountRate);
  return {
    displayAmount: view.payableAmount,
    preAmount: view.preAmount,
    showPreLine: view.active,
  };
}

/** Sole collect-modal secondary line (`collectDiscountDetail`: 折前 · 折扣 n%). */
export function formatCheckoutCollectDiscountDetail(
  template: string,
  preAmount: number,
  discountRate: number,
): string | null {
  const view = resolveCheckoutDiscountMoneyView(preAmount, discountRate);
  if (!view.active) return null;
  return template
    .replace('{pre}', view.preAmount.toFixed(2))
    .replace('{n}', String(view.rate));
}
