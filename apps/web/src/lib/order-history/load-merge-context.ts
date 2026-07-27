import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MERGED_CLOSE_REASON,
  normalizeMergeTargetStatus,
} from '@/lib/order-history/close-kind';
import type {
  OrderHistoryMergeSourceRef,
  OrderHistoryMergeTargetContext,
} from '@/lib/order-history/types';
import {
  resolveSessionTableDisplayName,
  tableDisplayNameMapFromRows,
  type TableDisplayRow,
} from '@/lib/order-history/resolve-session-table-display';

export type MergeTargetSessionRow = {
  id: string;
  table_id: string;
  status: string;
};

export type MergeSourceSessionRow = {
  id: string;
  table_id: string;
  closed_at: string;
  merge_into_session_id: string | null;
};

/** Includes soft-deleted tables so closed sessions keep a human label. */
export async function loadRestaurantTableDisplayNames(
  admin: SupabaseClient,
  restaurantId: string,
  tableIds: string[],
): Promise<Map<string, string>> {
  const uniqueTableIds = Array.from(new Set(tableIds.filter(Boolean)));
  if (uniqueTableIds.length === 0) return new Map();

  const { data, error } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', restaurantId)
    .in('id', uniqueTableIds);

  if (error || !data?.length) return new Map();
  return tableDisplayNameMapFromRows(data as TableDisplayRow[]);
}

export async function loadMergeTargetSessionsById(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<Map<string, MergeTargetSessionRow>> {
  const uniqueSessionIds = Array.from(new Set(sessionIds.filter(Boolean)));
  const map = new Map<string, MergeTargetSessionRow>();
  if (uniqueSessionIds.length === 0) return map;

  const { data, error } = await admin
    .from('table_sessions')
    .select('id, table_id, status')
    .eq('restaurant_id', restaurantId)
    .in('id', uniqueSessionIds);

  if (error || !data?.length) return map;

  for (const row of data as MergeTargetSessionRow[]) {
    map.set(row.id, row);
  }
  return map;
}

/** Direct merge sources for billing sessions on the current page. */
export async function loadMergeSourceSessionsByTargetId(
  admin: SupabaseClient,
  restaurantId: string,
  targetSessionIds: string[],
): Promise<Map<string, MergeSourceSessionRow[]>> {
  const uniqueTargetIds = Array.from(new Set(targetSessionIds.filter(Boolean)));
  const map = new Map<string, MergeSourceSessionRow[]>();
  if (uniqueTargetIds.length === 0) return map;

  const { data, error } = await admin
    .from('table_sessions')
    .select('id, table_id, closed_at, merge_into_session_id')
    .eq('restaurant_id', restaurantId)
    .eq('closed_reason', MERGED_CLOSE_REASON)
    .in('merge_into_session_id', uniqueTargetIds)
    .order('closed_at', { ascending: true });

  if (error || !data?.length) return map;

  for (const row of data as MergeSourceSessionRow[]) {
    const targetId = row.merge_into_session_id;
    if (!targetId) continue;
    const list = map.get(targetId) ?? [];
    list.push(row);
    map.set(targetId, list);
  }
  return map;
}

export function collectOrderHistoryTableIds(
  sessions: Array<{ table_id: string }>,
  mergeTargetById: Map<string, MergeTargetSessionRow>,
  mergeSourcesByTargetId: Map<string, MergeSourceSessionRow[]>,
): string[] {
  const ids = new Set<string>();
  for (const session of sessions) {
    ids.add(session.table_id);
  }
  for (const target of Array.from(mergeTargetById.values())) {
    ids.add(target.table_id);
  }
  for (const sources of Array.from(mergeSourcesByTargetId.values())) {
    for (const source of sources) {
      ids.add(source.table_id);
    }
  }
  return Array.from(ids);
}

export function assembleMergeTargetContext(
  mergeIntoSessionId: string | null,
  tableDisplayById: Map<string, string>,
  mergeTargetById: Map<string, MergeTargetSessionRow>,
): OrderHistoryMergeTargetContext | undefined {
  const targetSessionId = mergeIntoSessionId?.trim() ?? '';
  if (!targetSessionId) return undefined;

  const target = mergeTargetById.get(targetSessionId);
  const targetTableId = target?.table_id ?? '';
  const targetDisplayName = targetTableId
    ? resolveSessionTableDisplayName(targetTableId, tableDisplayById, [])
    : '—';

  return {
    targetSessionId,
    targetTableId,
    targetDisplayName,
    targetStatus: target
      ? normalizeMergeTargetStatus(target.status)
      : 'unknown',
  };
}

export function assembleMergeSourceRefs(
  sessionId: string,
  mergeSourcesByTargetId: Map<string, MergeSourceSessionRow[]>,
  tableDisplayById: Map<string, string>,
): OrderHistoryMergeSourceRef[] | undefined {
  const rows = mergeSourcesByTargetId.get(sessionId);
  if (!rows?.length) return undefined;

  return rows.map((row) => ({
    sourceSessionId: row.id,
    sourceTableId: row.table_id,
    sourceDisplayName: resolveSessionTableDisplayName(row.table_id, tableDisplayById, []),
    mergedAt: row.closed_at,
  }));
}
