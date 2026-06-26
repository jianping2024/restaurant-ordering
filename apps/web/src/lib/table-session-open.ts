import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionStatus } from '@/types';

export type TableSessionRef = { id: string; status: SessionStatus };

export async function findActiveTableSession(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<TableSessionRef | null> {
  const { data, error } = await admin
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as TableSessionRef | null) ?? null;
}

/** Return the active session for a table, creating one when absent. */
export async function ensureOpenTableSession(
  admin: SupabaseClient,
  params: {
    restaurant_id: string;
    table_id: string;
    opened_by_user_id: string;
  },
): Promise<{ session: TableSessionRef | null; error: string | null }> {
  const existing = await findActiveTableSession(admin, params.restaurant_id, params.table_id);
  if (existing) return { session: existing, error: null };

  const { data, error } = await admin
    .from('table_sessions')
    .insert({
      restaurant_id: params.restaurant_id,
      table_id: params.table_id,
      status: 'open',
      opened_by_user_id: params.opened_by_user_id,
    })
    .select('id, status')
    .single();

  if (error || !data) {
    return { session: null, error: error?.message ?? 'session_create_failed' };
  }
  return { session: data as TableSessionRef, error: null };
}
