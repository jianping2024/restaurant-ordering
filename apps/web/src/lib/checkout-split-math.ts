import {
  allocateProportionalCents,
  eurosToCents,
  centsToEuros,
} from '@/lib/money-allocation';
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

/** Per-row independent round — SQL `checkout_round_discount_amount`. Prefer {@link allocateDiscountedSplitObligations} for multi-person bills. */
export function discountedObligationAmount(
  preDiscountAmount: number,
  discountRate: number,
): number {
  const factor = 1 - clampCheckoutDiscountRate(discountRate) / 100;
  // Cents-first then round: avoids float (19.95×0.9→17.955→JS 17.95 vs PG round 17.96).
  return centsToEuros(Math.round(eurosToCents(Number(preDiscountAmount)) * factor));
}

/**
 * Sole multi-person post-discount obligations: one bill payable, then proportional cents.
 * One cut for a given (preAmounts, rate, billTotal) — do not freeze/re-split after collects.
 * Recompute only when discount, roster pre-amounts, or bill total change.
 */
export function allocateDiscountedSplitObligations(
  preAmounts: readonly number[],
  discountRate: number,
  options?: {
    /** When set, payable = round(billTotal × factor); else round(Σ pre × factor). */
    billTotalAmount?: number;
    /** Remainder sort key (default: index string). */
    sortKeyForIndex?: (index: number) => string;
  },
): number[] {
  const n = preAmounts.length;
  if (n === 0) return [];

  const rate = clampCheckoutDiscountRate(discountRate);
  if (rate <= 0) {
    return preAmounts.map((pre) => centsToEuros(eurosToCents(Number(pre))));
  }

  const billPre =
    options?.billTotalAmount != null && Number.isFinite(options.billTotalAmount)
      ? Number(options.billTotalAmount)
      : preAmounts.reduce((sum, pre) => sum + Number(pre), 0);
  const payableCents = eurosToCents(discountedObligationAmount(billPre, rate));
  const weights = preAmounts.map((pre) => Math.max(0, eurosToCents(Number(pre))));
  const sortKey = options?.sortKeyForIndex ?? ((index: number) => String(index));
  const cents = allocateProportionalCents(payableCents, weights, sortKey);
  return cents.map(centsToEuros);
}

export function applyDiscountToRows(rows: SplitResult[], discountRate: number): SplitResult[] {
  const preAmounts = rows.map((row) => row.amount);
  const allocated = allocateDiscountedSplitObligations(preAmounts, discountRate);
  return rows.map((row, index) => ({
    ...row,
    amount: allocated[index] ?? discountedObligationAmount(row.amount, discountRate),
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
 * Sole money view under bill-level % discount (bar / single amount).
 * Multi-person shares use {@link allocateDiscountedSplitObligations} then share display.
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

/**
 * Sole person-share display: primary = allocated 折后; optional muted 折前.
 * Pass `allocatedPayable` from {@link allocateDiscountedSplitObligations}.
 */
export function resolveCheckoutDiscountedShareDisplay(
  preAmount: number,
  discountRate: number,
  allocatedPayable?: number,
): { displayAmount: number; preAmount: number; showPreLine: boolean } {
  const rate = clampCheckoutDiscountRate(discountRate);
  const pre = centsToEuros(eurosToCents(Number(preAmount)));
  const displayAmount =
    allocatedPayable != null && Number.isFinite(allocatedPayable)
      ? centsToEuros(eurosToCents(Number(allocatedPayable)))
      : discountedObligationAmount(pre, rate);
  return {
    displayAmount,
    preAmount: pre,
    showPreLine: rate > 0 && eurosToCents(displayAmount) !== eurosToCents(pre),
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
