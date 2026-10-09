/**
 * Sole gate: staff checkout detail soft-confirm when buffet restaurant + headcount is 0.
 * Call-checkout no longer hard-blocks on headcount — this prompt is the only staff warning.
 * Headcount truth: {@link isBillGuestCountConfirmed} / {@link guestCountFromTableOrders}.
 */
export function shouldPromptCheckoutZeroHeadcount(input: {
  restaurantHasActiveBuffets: boolean;
  guestCountConfirmed: boolean;
  acknowledgedZeroHeadcount: boolean;
}): boolean {
  if (!input.restaurantHasActiveBuffets) return false;
  if (input.acknowledgedZeroHeadcount) return false;
  return !input.guestCountConfirmed;
}
