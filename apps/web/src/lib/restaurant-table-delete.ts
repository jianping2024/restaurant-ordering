import type { SupabaseClient } from '@supabase/supabase-js';
import { parseTableIdParam, type RestaurantTableRow } from '@/lib/restaurant-tables';

export type DeleteRestaurantTablesError =
  | 'invalid_table_ids'
  | 'tables_not_found'
  | 'tables_have_active_sessions'
  | 'delete_failed';

export function parseDeleteTableIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const id = parseTableIdParam(item);
    if (!id) return null;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.length > 0 ? ids : null;
}

export function resolveDeleteTableTargets(
  tableIds: string[],
  activeTables: RestaurantTableRow[],
): { ok: true; targets: RestaurantTableRow[] } | { ok: false; error: 'tables_not_found' } {
  const tableById = new Map(activeTables.map((row) => [row.id, row]));
  const targets: RestaurantTableRow[] = [];
  for (const id of tableIds) {
    const row = tableById.get(id);
    if (!row) {
      return { ok: false, error: 'tables_not_found' };
    }
    targets.push(row);
  }
  return { ok: true, targets };
}

export async function deleteRestaurantTables(
  admin: SupabaseClient,
  restaurantId: string,
  targets: RestaurantTableRow[],
): Promise<{ ok: true } | { ok: false; error: DeleteRestaurantTablesError; displayNames?: string[] }> {
  if (targets.length === 0) {
    return { ok: false, error: 'invalid_table_ids' };
  }

  const tableIds = targets.map((row) => row.id);
  const { data: activeSessions, error: sessionError } = await admin
    .from('table_sessions')
    .select('table_id')
    .eq('restaurant_id', restaurantId)
    .in('table_id', tableIds)
    .in('status', ['open', 'billing']);

  if (sessionError) {
    return { ok: false, error: 'delete_failed' };
  }

  const blockedIds = new Set((activeSessions || []).map((row) => row.table_id as string));
  if (blockedIds.size > 0) {
    const displayNames = targets
      .filter((row) => blockedIds.has(row.id))
      .map((row) => row.display_name);
    return { ok: false, error: 'tables_have_active_sessions', displayNames };
  }

  const { error: memberError } = await admin
    .from('restaurant_table_group_members')
    .delete()
    .in('table_id', tableIds)
    .eq('restaurant_id', restaurantId);
  if (memberError) {
    return { ok: false, error: 'delete_failed' };
  }

  const { error: deleteError } = await admin
    .from('restaurant_tables')
    .update({ deleted_at: new Date().toISOString() })
    .eq('restaurant_id', restaurantId)
    .in('id', tableIds)
    .is('deleted_at', null);
  if (deleteError) {
    return { ok: false, error: 'delete_failed' };
  }

  return { ok: true };
}
