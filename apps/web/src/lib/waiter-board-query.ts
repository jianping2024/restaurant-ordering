import type { Order } from '@/types';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';

export const ACTIVE_ORDER_STATUSES = ['pending', 'cooking', 'done'] as const;

export function sessionMetaByTableIdFromSessions(
  sessions: Array<{
    id?: string | null;
    table_id?: string | null;
    opened_at?: string | null;
    status?: string | null;
    opened_by_user_id?: string | null;
  }>,
  openedByNameByUserId: ReadonlyMap<string, string> = new Map(),
): Record<string, WaiterTableSessionMeta> {
  const sessionMetaByTableId: Record<string, WaiterTableSessionMeta> = {};
  for (const s of sessions) {
    const tid = s.table_id as string | undefined;
    const sid = s.id as string | undefined;
    const openedAt = s.opened_at as string | undefined;
    const status = s.status as string | undefined;
    if (
      tid &&
      sid &&
      openedAt &&
      (status === 'open' || status === 'billing')
    ) {
      const openedByUserId = s.opened_by_user_id as string | undefined;
      const openedByName = openedByUserId
        ? openedByNameByUserId.get(openedByUserId) ?? null
        : null;
      sessionMetaByTableId[tid] = {
        sessionId: sid,
        openedAt,
        status,
        ...(openedByName ? { openedByName } : {}),
      };
    }
  }
  return sessionMetaByTableId;
}

export function filterOrdersInActiveSessions(
  orders: Order[],
  sessions: Array<{ id?: string | null }>,
): Order[] {
  const activeIds = new Set(
    (sessions || []).map((s) => s.id as string).filter(Boolean),
  );
  return orders.filter((o) => !o.session_id || activeIds.has(o.session_id as string));
}
