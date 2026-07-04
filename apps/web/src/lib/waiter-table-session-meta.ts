import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import type { TableSessionRef } from '@/lib/table-session-open';
import type { SessionStatus } from '@/types';

export type WaiterTableSessionRow = {
  id: string;
  table_id: string;
  opened_at: string;
  status: string;
};

export function sessionMetaFromRow(sessionRow: WaiterTableSessionRow | null): WaiterTableSessionMeta | null {
  if (
    !sessionRow?.id ||
    !sessionRow.opened_at ||
    (sessionRow.status !== 'open' && sessionRow.status !== 'billing')
  ) {
    return null;
  }
  return {
    sessionId: sessionRow.id,
    openedAt: sessionRow.opened_at,
    status: sessionRow.status as 'open' | 'billing',
  };
}

export function tableSessionRefFromRow(sessionRow: WaiterTableSessionRow): TableSessionRef {
  return {
    id: sessionRow.id,
    status: sessionRow.status as SessionStatus,
    opened_at: sessionRow.opened_at,
  };
}

/** Session meta after ensure — reuse pre-fetched row or fall back to the ensured session. */
export function sessionMetaFromEnsuredSession(
  sessionRow: WaiterTableSessionRow | null,
  ensured: TableSessionRef,
): WaiterTableSessionMeta {
  const fromRow = sessionMetaFromRow(sessionRow);
  if (fromRow) return fromRow;
  return {
    sessionId: ensured.id,
    openedAt: ensured.opened_at,
    status: ensured.status as 'open' | 'billing',
  };
}
