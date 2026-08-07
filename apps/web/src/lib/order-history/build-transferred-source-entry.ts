import { buildSessionLifecycleSteps } from '@/lib/order-history/build-session-lifecycle';
import { buildOperationalSourceSessionSettlement } from '@/lib/order-history/build-session-settlement';
import { assembleMergeTargetContext } from '@/lib/order-history/load-merge-context';
import type { MergeTargetSessionRow } from '@/lib/order-history/load-merge-context';
import type { TransferOutEventRow } from '@/lib/order-history/load-session-transfer-events';
import type { OrderHistoryEntry } from '@/lib/order-history/types';

export type TransferSourceSessionMeta = {
  opened_at: string | null;
  opened_by_user_id: string | null;
};

/** Project one transfer-out event as a source-table operational history row. */
export function buildTransferredSourceEntry(
  event: TransferOutEventRow,
  sessionMeta: TransferSourceSessionMeta | undefined,
  tableDisplayById: Map<string, string>,
  continuedSessionById: Map<string, MergeTargetSessionRow>,
  operatorNames: ReadonlyMap<string, string>,
): OrderHistoryEntry {
  const closedByName = event.operator_user_id
    ? operatorNames.get(event.operator_user_id) ?? null
    : null;
  const openedByName = sessionMeta?.opened_by_user_id
    ? operatorNames.get(sessionMeta.opened_by_user_id) ?? null
    : null;

  const entryFacts = {
    historyRecordId: `transfer:${event.id}`,
    sessionId: event.session_id,
    tableId: event.from_table_id,
    displayName: event.from_display_name?.trim() || '—',
    closeKind: 'transferred_source' as const,
    openedAt: sessionMeta?.opened_at ?? null,
    openedByName,
    closedAt: event.occurred_at,
    closedByName,
    closedReason: null,
    itemCount: 0,
    settlement: buildOperationalSourceSessionSettlement(),
    closeAnnotation: { isForcedUnpaidClose: false as const },
    mergeContext: assembleMergeTargetContext(
      event.session_id,
      tableDisplayById,
      continuedSessionById,
    ),
    orders: [] as OrderHistoryEntry['orders'],
    billSplit: undefined,
    transferEvents: undefined,
  };

  return {
    ...entryFacts,
    lifecycleSteps: buildSessionLifecycleSteps({ ...entryFacts, lifecycleSteps: [] }),
  };
}
