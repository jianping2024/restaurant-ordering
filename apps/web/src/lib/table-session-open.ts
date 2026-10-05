import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionStatus } from '@/types';
import { resolveStaffOperatorName } from '@/lib/order-history/resolve-staff-operator';

export type TableSessionRef = {
  id: string;
  status: SessionStatus;
  opened_at: string;
  /** Snapshot at insert; null when existing row predated the column. */
  opened_by_name?: string | null;
};

type OpenSessionParams = {
  restaurant_id: string;
  table_id: string;
  opened_by_user_id: string;
};

async function loadRestaurantNameContext(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ ownerId: string; restaurantName: string } | null> {
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('owner_id, name')
    .eq('id', restaurantId)
    .maybeSingle();
  if (!restaurant?.name?.trim()) return null;
  return {
    ownerId: typeof restaurant.owner_id === 'string' ? restaurant.owner_id : '',
    restaurantName: restaurant.name as string,
  };
}

/**
 * Sole stamp of table_sessions.opened_by_name — call only when inserting an open session.
 * Uses resolveStaffOperatorName (staff display/login → Auth → owner).
 */
export async function resolveOpenedByNameForOpen(
  admin: SupabaseClient,
  params: { restaurantId: string; openedByUserId: string },
): Promise<string | null> {
  const restaurant = await loadRestaurantNameContext(admin, params.restaurantId);
  if (!restaurant) return null;
  return resolveStaffOperatorName(admin, {
    restaurantId: params.restaurantId,
    ownerId: restaurant.ownerId,
    restaurantName: restaurant.restaurantName,
    userId: params.openedByUserId,
  });
}

export async function findActiveTableSession(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<TableSessionRef | null> {
  const { data, error } = await admin
    .from('table_sessions')
    .select('id, status, opened_at, opened_by_name')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as TableSessionRef | null) ?? null;
}

async function insertOpenTableSession(
  admin: SupabaseClient,
  params: OpenSessionParams,
): Promise<{ session: TableSessionRef | null; error: string | null }> {
  const openedByName = await resolveOpenedByNameForOpen(admin, {
    restaurantId: params.restaurant_id,
    openedByUserId: params.opened_by_user_id,
  });

  const { data, error } = await admin
    .from('table_sessions')
    .insert({
      restaurant_id: params.restaurant_id,
      table_id: params.table_id,
      status: 'open',
      opened_by_user_id: params.opened_by_user_id,
      opened_by_name: openedByName,
    })
    .select('id, status, opened_at, opened_by_name')
    .single();

  if (error || !data) {
    return { session: null, error: error?.message ?? 'session_create_failed' };
  }
  return { session: data as TableSessionRef, error: null };
}

/** Use a pre-fetched active session or insert a new open session. */
export async function openTableSessionIfAbsent(
  admin: SupabaseClient,
  params: OpenSessionParams,
  existing: TableSessionRef | null,
): Promise<{ session: TableSessionRef | null; error: string | null }> {
  if (existing) return { session: existing, error: null };
  return insertOpenTableSession(admin, params);
}

/** Return the active session for a table, creating one when absent. */
export async function ensureOpenTableSession(
  admin: SupabaseClient,
  params: OpenSessionParams,
): Promise<{ session: TableSessionRef | null; error: string | null }> {
  const existing = await findActiveTableSession(admin, params.restaurant_id, params.table_id);
  return openTableSessionIfAbsent(admin, params, existing);
}
