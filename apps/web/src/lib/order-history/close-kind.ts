/** Source table session closed by merge_table_sessions RPC. */
export const MERGED_CLOSE_REASON = 'merged' as const;

export type OrderHistoryCloseKind = 'billing' | 'merged_source' | 'transferred_source';

export type OrderHistoryMergeTargetStatus = 'closed' | 'open' | 'billing' | 'unknown';

export function isMergedCloseReason(
  reason: string | null | undefined,
): reason is typeof MERGED_CLOSE_REASON {
  return reason === MERGED_CLOSE_REASON;
}

export function resolveOrderHistoryCloseKind(
  closedReason: string | null | undefined,
): OrderHistoryCloseKind {
  return isMergedCloseReason(closedReason) ? 'merged_source' : 'billing';
}

export function isMergedSourceCloseKind(
  closeKind: OrderHistoryCloseKind,
): closeKind is 'merged_source' {
  return closeKind === 'merged_source';
}

export function isTransferredSourceCloseKind(
  closeKind: OrderHistoryCloseKind,
): closeKind is 'transferred_source' {
  return closeKind === 'transferred_source';
}

/** Source-table operational closes (merge or transfer-out); not billing closes. */
export function isOperationalSourceCloseKind(
  closeKind: OrderHistoryCloseKind,
): closeKind is 'merged_source' | 'transferred_source' {
  return closeKind === 'merged_source' || closeKind === 'transferred_source';
}

export function normalizeMergeTargetStatus(
  status: string | null | undefined,
): OrderHistoryMergeTargetStatus {
  if (status === 'closed' || status === 'open' || status === 'billing') {
    return status;
  }
  return 'unknown';
}
