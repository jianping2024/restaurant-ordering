import type { TableOrderRoundStatus } from '@/lib/table-order-round/types';

/**
 * Sole gate for auto-opening sushi「本轮核单」after submit / resume / enter.
 * Manual「去送厨」does not use this — it always opens the same sheet.
 *
 * Open when the table still has unsent free dishes and the round is not in
 * countdown or table cooldown. `finalize_failed` may open (guest can see retry).
 */
export function shouldAutoOpenRoundReview(input: {
  tableReviewQty: number;
  status: TableOrderRoundStatus | null | undefined;
}): boolean {
  const qty = Math.max(0, Math.floor(input.tableReviewQty));
  if (qty < 1) return false;
  if (input.status === 'pending_confirm') return false;
  if (input.status === 'cooldown') return false;
  return true;
}
