import type { SupabaseClient } from '@supabase/supabase-js';
import { isDbMigrationRequiredError } from './db-migration-error';

type OpenSessionRow = { id: string; status: string };

/** Create an open table_sessions row; omit opener column when migration not applied yet. */
export async function insertOpenTableSession(
  admin: SupabaseClient,
  params: {
    restaurant_id: string;
    table_id: string;
    opened_by_user_id?: string | null;
  },
): Promise<{ data: OpenSessionRow | null; error: string | null }> {
  const base = {
    restaurant_id: params.restaurant_id,
    table_id: params.table_id,
    status: 'open' as const,
  };

  if (params.opened_by_user_id) {
    const withOpener = await admin
      .from('table_sessions')
      .insert({ ...base, opened_by_user_id: params.opened_by_user_id })
      .select('id, status')
      .single();
    if (!withOpener.error && withOpener.data) {
      return { data: withOpener.data as OpenSessionRow, error: null };
    }
    if (!isDbMigrationRequiredError(withOpener.error)) {
      return { data: null, error: withOpener.error?.message ?? 'session_create_failed' };
    }
  }

  const legacy = await admin.from('table_sessions').insert(base).select('id, status').single();
  if (legacy.error || !legacy.data) {
    return { data: null, error: legacy.error?.message ?? 'session_create_failed' };
  }
  return { data: legacy.data as OpenSessionRow, error: null };
}

export type ActiveSessionOpenerRow = { id: string; opened_by_user_id: string | null };

/** Load active sessions; tolerate missing opened_by_user_id column before migration. */
export async function loadActiveSessionsWithOpener(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<ActiveSessionOpenerRow[]> {
  const { data, error } = await admin
    .from('table_sessions')
    .select('id, opened_by_user_id')
    .eq('restaurant_id', restaurantId)
    .in('status', ['open', 'billing']);

  if (!error) {
    return (data || []) as ActiveSessionOpenerRow[];
  }
  if (!isDbMigrationRequiredError(error)) {
    throw error;
  }

  const { data: legacy, error: legacyError } = await admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .in('status', ['open', 'billing']);

  if (legacyError) throw legacyError;
  return (legacy || []).map((row) => ({
    id: row.id as string,
    opened_by_user_id: null,
  }));
}
