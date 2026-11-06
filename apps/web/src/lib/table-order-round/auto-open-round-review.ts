import type { TableOrderRoundStatus } from '@/lib/table-order-round/types';

/**
 * Sole gate for auto-opening sushi「本轮核单」.
 *
 * Open when the table still has unsent free dishes and the round is not in
 * send countdown. Session kitchen cooldown no longer blocks opening — guests
 * may review the next basket while waiting to send. `finalize_failed` may open.
 */
export function shouldAutoOpenRoundReview(input: {
  tableReviewQty: number;
  status: TableOrderRoundStatus | null | undefined;
}): boolean {
  const qty = Math.max(0, Math.floor(input.tableReviewQty));
  if (qty < 1) return false;
  if (input.status === 'pending_confirm') return false;
  return true;
}
