import type { TableSession } from '@/types';

/** Active open table session — 开台占桌，尚未结账。 */
export function isTableSessionOpen(
  session: Pick<TableSession, 'status'> | null | undefined,
): boolean {
  return session?.status === 'open';
}

/** Menu ordering (guest or waiter) requires an open table session (开台即可加菜). */
export function guestOrderingEnabled(
  session: Pick<TableSession, 'status'> | null | undefined,
): boolean {
  return isTableSessionOpen(session);
}
