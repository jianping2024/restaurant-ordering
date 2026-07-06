import type { Order, TableSession } from '@/types';
import { hasActiveBuffetForOrders } from '@/lib/buffet-order';

/** Menu ordering (guest or waiter) requires open session + active buffet_base (开台优先). */
export function guestOrderingEnabled(
  session: Pick<TableSession, 'status'> | null | undefined,
  sessionOrders: Order[],
): boolean {
  if (!session || session.status !== 'open') return false;
  return hasActiveBuffetForOrders(sessionOrders);
}
