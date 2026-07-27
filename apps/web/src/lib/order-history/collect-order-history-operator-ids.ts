import type { OrderHistoryTransferEvent } from '@/lib/order-history/types';
import type { MergeSourceSessionRow } from '@/lib/order-history/load-merge-context';

type ClosedSessionOperatorRow = {
  opened_by_user_id: string | null;
  closed_by_user_id: string | null;
};

/** User ids for open/close/merge/transfer operators on a history page batch. */
export function collectOrderHistoryOperatorIds(
  sessions: ClosedSessionOperatorRow[],
  mergeSourcesByTargetId: Map<string, MergeSourceSessionRow[]>,
  transferEventsBySession: Map<string, OrderHistoryTransferEvent[]>,
): string[] {
  const operatorIds = sessions.flatMap((session) =>
    [session.opened_by_user_id, session.closed_by_user_id].filter(
      (id): id is string => !!id,
    ),
  );

  for (const sources of Array.from(mergeSourcesByTargetId.values())) {
    for (const source of sources) {
      if (source.closed_by_user_id) operatorIds.push(source.closed_by_user_id);
    }
  }

  for (const events of Array.from(transferEventsBySession.values())) {
    for (const event of events) {
      if (event.operatorUserId) operatorIds.push(event.operatorUserId);
    }
  }

  return operatorIds;
}
