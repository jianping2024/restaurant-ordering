import type { Order, TableSession } from '@/types';
import { aggregateBuffetForOrders } from '@/lib/buffet-order';

/** Guest may order menu items only after waiter posted buffet (active buffet_base on open session). */
export function guestOrderingEnabled(
  session: Pick<TableSession, 'status'> | null | undefined,
  sessionOrders: Order[],
): boolean {
  if (!session || session.status !== 'open') return false;
  return aggregateBuffetForOrders(sessionOrders) != null;
}
