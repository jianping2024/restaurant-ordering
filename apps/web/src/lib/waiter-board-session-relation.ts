import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  WaiterBoardSessionRelation,
  WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';

export type { WaiterBoardSessionRelation };

/**
 * Batch-load which active sessions received merges / transfers.
 * Sole board relation read; attach onto session meta (one field).
 */
export async function loadBoardSessionRelationBySessionId(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: readonly string[],
): Promise<Map<string, WaiterBoardSessionRelation>> {
  const out = new Map<string, WaiterBoardSessionRelation>();
  const unique = Array.from(new Set(sessionIds.filter(Boolean)));
  if (unique.length === 0) return out;

  const [{ data: mergeRows }, { data: transferRows }] = await Promise.all([
    admin
      .from('table_sessions')
      .select('merge_into_session_id')
      .eq('restaurant_id', restaurantId)
      .in('merge_into_session_id', unique)
      .not('merge_into_session_id', 'is', null),
    admin
      .from('table_session_events')
      .select('session_id')
      .eq('restaurant_id', restaurantId)
      .eq('event_type', 'transfer')
      .in('session_id', unique),
  ]);

  for (const row of transferRows || []) {
    const sid = row.session_id as string | undefined;
    if (sid) out.set(sid, 'transferred');
  }
  for (const row of mergeRows || []) {
    const sid = row.merge_into_session_id as string | undefined;
    if (sid) out.set(sid, 'merged');
  }
  return out;
}

/** Stamp `boardRelation` onto each meta row (mutates values into a new map). */
export function applyBoardSessionRelations(
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
  relationBySessionId: ReadonlyMap<string, WaiterBoardSessionRelation>,
): Record<string, WaiterTableSessionMeta> {
  if (relationBySessionId.size === 0) {
    return sessionMetaByTableId;
  }
  const next: Record<string, WaiterTableSessionMeta> = {};
  for (const [tableId, meta] of Object.entries(sessionMetaByTableId)) {
    const relation = relationBySessionId.get(meta.sessionId) ?? null;
    next[tableId] = relation ? { ...meta, boardRelation: relation } : meta;
  }
  return next;
}

export async function attachBoardSessionRelations(
  admin: SupabaseClient,
  restaurantId: string,
  sessionMetaByTableId: Record<string, WaiterTableSessionMeta>,
): Promise<Record<string, WaiterTableSessionMeta>> {
  const sessionIds = Object.values(sessionMetaByTableId).map((meta) => meta.sessionId);
  const relationBySessionId = await loadBoardSessionRelationBySessionId(
    admin,
    restaurantId,
    sessionIds,
  );
  return applyBoardSessionRelations(sessionMetaByTableId, relationBySessionId);
}
