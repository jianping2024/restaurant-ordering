import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import { sessionMetaByTableIdFromSessions } from '@/lib/waiter-board-query';
import { normalizeOrderingChannel } from '@/lib/instore-takeaway';
import type { TableSessionRef } from '@/lib/table-session-open';
import type { SessionStatus } from '@/types';

export type WaiterTableSessionRow = {
  id: string;
  table_id: string;
  opened_at: string;
  status: string;
  opened_by_user_id?: string | null;
  /** Sole board opener label — stamped at open. */
  opened_by_name?: string | null;
  ordering_channel?: string | null;
};

function withSessionExtras(
  meta: WaiterTableSessionMeta,
  openedByName: string | null | undefined,
  orderingChannelRaw: unknown,
): WaiterTableSessionMeta {
  const name = openedByName?.trim();
  const orderingChannel = normalizeOrderingChannel(orderingChannelRaw);
  return {
    ...meta,
    ...(name ? { openedByName: name } : {}),
    orderingChannel,
  };
}

/** Board meta from a session row — opener is only `opened_by_name` (no id resolve). */
export function sessionMetaFromRow(
  sessionRow: WaiterTableSessionRow | null,
): WaiterTableSessionMeta | null {
  if (
    !sessionRow?.id ||
    !sessionRow.opened_at ||
    (sessionRow.status !== 'open' && sessionRow.status !== 'billing')
  ) {
    return null;
  }
  return withSessionExtras(
    {
      sessionId: sessionRow.id,
      openedAt: sessionRow.opened_at,
      status: sessionRow.status as 'open' | 'billing',
    },
    sessionRow.opened_by_name,
    sessionRow.ordering_channel,
  );
}

export function tableSessionRefFromRow(sessionRow: WaiterTableSessionRow): TableSessionRef {
  return {
    id: sessionRow.id,
    status: sessionRow.status as SessionStatus,
    opened_at: sessionRow.opened_at,
    opened_by_name: sessionRow.opened_by_name ?? null,
    ordering_channel: normalizeOrderingChannel(sessionRow.ordering_channel),
  };
}

/** Session meta after ensure — reuse pre-fetched row or fall back to the ensured session. */
export function sessionMetaFromEnsuredSession(
  sessionRow: WaiterTableSessionRow | null,
  ensured: TableSessionRef,
): WaiterTableSessionMeta {
  const fromRow = sessionMetaFromRow(sessionRow);
  if (fromRow) return fromRow;
  return withSessionExtras(
    {
      sessionId: ensured.id,
      openedAt: ensured.opened_at,
      status: ensured.status as 'open' | 'billing',
    },
    ensured.opened_by_name,
    ensured.ordering_channel,
  );
}

/** Active board sessions → meta map; opener from stamped `opened_by_name` only. */
export function buildActiveSessionMetaByTableId(
  sessions: WaiterTableSessionRow[],
): Record<string, WaiterTableSessionMeta> {
  return sessionMetaByTableIdFromSessions(sessions);
}
