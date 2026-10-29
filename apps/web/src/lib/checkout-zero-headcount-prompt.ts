import { normalizeOrderingChannel, type OrderingChannel } from '@/lib/instore-takeaway';

/**
 * Sole gate: staff checkout detail soft-confirm when buffet restaurant + headcount is 0.
 * Call-checkout no longer hard-blocks on headcount — this prompt is the only staff warning.
 * Takeaway sessions open at headcount 0 by design and never prompt (no per-head charge).
 * Headcount truth: {@link isBillGuestCountConfirmed} / {@link guestCountFromTableOrders}.
 */
export function shouldPromptCheckoutZeroHeadcount(input: {
  restaurantHasActiveBuffets: boolean;
  guestCountConfirmed: boolean;
  acknowledgedZeroHeadcount: boolean;
  /** Session stamp — takeaway never soft-prompts zero headcount. */
  orderingChannel?: OrderingChannel | string | null;
}): boolean {
  if (normalizeOrderingChannel(input.orderingChannel) === 'takeaway') return false;
  if (!input.restaurantHasActiveBuffets) return false;
  if (input.acknowledgedZeroHeadcount) return false;
  return !input.guestCountConfirmed;
}
