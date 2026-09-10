import type { Dispatch, SetStateAction } from 'react';
import { sumCartQty } from '@/lib/cart-totals';

/** Sole CSS class for footer cart badge/icon pop on successful qty increase. */
export const CUSTOMER_CART_ADD_FEEDBACK_CLASS = 'mesa-cart-badge-pop';

/**
 * Sole bump rule: increment feedback key only when total cart qty rises.
 * Call from cart commit paths after computing next lines (not on click / gate fail).
 */
export function bumpCartAddFeedbackKeyIfIncreased(
  setKey: Dispatch<SetStateAction<number>>,
  previousCart: ReadonlyArray<{ qty?: unknown }>,
  nextCart: ReadonlyArray<{ qty?: unknown }>,
): void {
  if (sumCartQty(nextCart) > sumCartQty(previousCart)) {
    setKey((key) => key + 1);
  }
}
