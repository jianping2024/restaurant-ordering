import { clampCheckoutDiscountRate } from '@/lib/checkout-split-math';

export type CheckoutDiscountCommitDecision =
  | { kind: 'needs_reason'; rate: number; previousRate: number }
  | { kind: 'persist'; rate: number }
  | { kind: 'clear_draft' };

/**
 * Sole discount-commit decision (after IntegerInput blur parse).
 * Uses the just-committed rate — never re-read a possibly stale display draft.
 */
export function resolveCheckoutDiscountCommit(params: {
  rate: number;
  serverRate: number;
  serverReason: string | null | undefined;
  previousRate: number;
}): CheckoutDiscountCommitDecision {
  const rate = clampCheckoutDiscountRate(params.rate);
  const serverRate = clampCheckoutDiscountRate(params.serverRate);
  if (rate > 0 && !params.serverReason?.trim()) {
    return {
      kind: 'needs_reason',
      rate,
      previousRate: clampCheckoutDiscountRate(params.previousRate),
    };
  }
  if (rate === serverRate) {
    return { kind: 'clear_draft' };
  }
  return { kind: 'persist', rate };
}
