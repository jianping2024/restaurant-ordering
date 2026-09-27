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
 * `frozenObligationByIndex` keeps already-settled tickets (independent-round stamp) so only
 * unpaid rows share the remaining payable — Σ(all) = payable.
 */
export function allocateDiscountedSplitObligations(
  preAmounts: readonly number[],
  discountRate: number,
  options?: {
    /** When set, payable = round(billTotal × factor); else round(Σ pre × factor). */
    billTotalAmount?: number;
    frozenObligationByIndex?: ReadonlyMap<number, number>;
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

  const frozen = options?.frozenObligationByIndex;
  const out = Array.from({ length: n }, () => 0);
  let frozenCents = 0;
  const openIndexes: number[] = [];
  const openWeights: number[] = [];

  for (let i = 0; i < n; i += 1) {
    const frozenAmount = frozen?.get(i);
    if (frozenAmount != null && Number.isFinite(frozenAmount)) {
      const cents = eurosToCents(Number(frozenAmount));
      out[i] = cents;
      frozenCents += cents;
      continue;
    }
    openIndexes.push(i);
    openWeights.push(Math.max(0, eurosToCents(Number(preAmounts[i]))));
  }

  const remainingPayable = Math.max(0, payableCents - frozenCents);
  if (openIndexes.length === 0) {
    return out.map(centsToEuros);
  }

  const sortKey = options?.sortKeyForIndex ?? ((index: number) => String(index));
  const openCents = allocateProportionalCents(remainingPayable, openWeights, (openIdx) =>
    sortKey(openIndexes[openIdx]!),
  );
  openIndexes.forEach((rowIndex, openIdx) => {
    out[rowIndex] = openCents[openIdx] ?? 0;
  });
  return out.map(centsToEuros);
}

/**
 * Freeze stamps from ledger for allocate-with-remainder.
 * 1) Prefer open allocate obligation when collected already covers it (allocate-first pays).
 * 2) Else if collected covers independent per-row round, freeze at that independent stamp
 *    (continuation after partial collect under the old formula).
 */
export function frozenDiscountObligationsFromLedger(
  preAmounts: readonly number[],
  discountRate: number,
  collectedByIndex: ReadonlyMap<number, number>,
  options?: { billTotalAmount?: number },
): Map<number, number> {
  const frozen = new Map<number, number>();
  const rate = clampCheckoutDiscountRate(discountRate);
  if (rate <= 0) return frozen;

  const allocated = allocateDiscountedSplitObligations(preAmounts, rate, {
    billTotalAmount: options?.billTotalAmount,
  });

  preAmounts.forEach((pre, index) => {
    const collected = collectedByIndex.get(index) ?? 0;
    if (collected <= 0) return;
    const allocatedAmount = allocated[index] ?? 0;
    if (eurosToCents(collected) >= eurosToCents(allocatedAmount)) {
      frozen.set(index, allocatedAmount);
      return;
    }
    const independent = discountedObligationAmount(pre, rate);
    if (eurosToCents(collected) >= eurosToCents(independent)) {
      frozen.set(index, independent);
    }
  });
  return frozen;
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
