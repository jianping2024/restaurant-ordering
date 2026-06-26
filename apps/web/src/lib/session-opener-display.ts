import type { SupabaseClient } from '@supabase/supabase-js';

export type ActiveSessionOpenerRow = { id: string; opened_by_user_id: string | null };

export async function loadActiveSessionOpeners(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<ActiveSessionOpenerRow[]> {
  const { data, error } = await admin
    .from('table_sessions')
    .select('id, opened_by_user_id')
    .eq('restaurant_id', restaurantId)
    .in('status', ['open', 'billing']);

  if (error) throw error;
  return (data || []) as ActiveSessionOpenerRow[];
}

/** session_id → staff display_name for active-order cards. */
export async function resolveOpenedByNameBySessionId(
  admin: SupabaseClient,
  restaurantId: string,
  sessions: ActiveSessionOpenerRow[],
): Promise<Record<string, string>> {
  const userIds = Array.from(
    new Set(
      sessions
        .map((s) => s.opened_by_user_id)
        .filter((id): id is string => !!id),
    ),
  );

  const staffNameByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: staffRows } = await admin
      .from('restaurant_staff_accounts')
      .select('user_id, display_name')
      .eq('restaurant_id', restaurantId)
      .in('user_id', userIds);

    for (const row of staffRows || []) {
      const name = (row.display_name as string | null)?.trim();
      if (row.user_id && name) {
        staffNameByUserId.set(row.user_id as string, name);
      }
    }
  }

  const result: Record<string, string> = {};
  for (const session of sessions) {
    const userId = session.opened_by_user_id;
    if (!userId) continue;
    const name = staffNameByUserId.get(userId);
    if (name) result[session.id] = name;
  }
  return result;
}
