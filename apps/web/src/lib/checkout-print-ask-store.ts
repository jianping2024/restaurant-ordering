import type { CheckoutPrintAsk } from '@/components/dashboard/checkout/CheckoutPrintChoiceDialog';

/**
 * Survives CheckoutRequestsProvider remounts (RSC soft refresh / Fast Refresh).
 * React state alone is not enough after all_paid — the layout can remount before
 * staff answers the print question.
 */
let pendingPrintAsk: CheckoutPrintAsk | null = null;

export function readPendingCheckoutPrintAsk(): CheckoutPrintAsk | null {
  return pendingPrintAsk;
}

export function writePendingCheckoutPrintAsk(ask: CheckoutPrintAsk | null): void {
  pendingPrintAsk = ask;
  if (typeof window !== 'undefined') {
    (window as unknown as { __mesaPrintAsk?: CheckoutPrintAsk | null }).__mesaPrintAsk = ask;
  }
}
