import type { SupabaseClient } from '@supabase/supabase-js';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import { sessionMetaByTableIdFromSessions } from '@/lib/waiter-board-query';
import { resolveOpenedByName, resolveOpenedByNames } from '@/lib/order-history/resolve-opened-by';
import type { TableSessionRef } from '@/lib/table-session-open';
import type { SessionStatus } from '@/types';

export type WaiterTableSessionRow = {
  id: string;
  table_id: string;
  opened_at: string;
  status: string;
  opened_by_user_id?: string | null;
};

function withOpenedByName(
  meta: WaiterTableSessionMeta,
  openedByName: string | null | undefined,
): WaiterTableSessionMeta {
  const name = openedByName?.trim();
  return name ? { ...meta, openedByName: name } : meta;
}

export function sessionMetaFromRow(
  sessionRow: WaiterTableSessionRow | null,
  openedByName?: string | null,
): WaiterTableSessionMeta | null {
  if (
    !sessionRow?.id ||
    !sessionRow.opened_at ||
    (sessionRow.status !== 'open' && sessionRow.status !== 'billing')
  ) {
    return null;
  }
  return withOpenedByName(
    {
      sessionId: sessionRow.id,
      openedAt: sessionRow.opened_at,
      status: sessionRow.status as 'open' | 'billing',
    },
    openedByName,
  );
}

export function tableSessionRefFromRow(sessionRow: WaiterTableSessionRow): TableSessionRef {
  return {
    id: sessionRow.id,
    status: sessionRow.status as SessionStatus,
    opened_at: sessionRow.opened_at,
  };
}

/** Session meta after ensure — reuse pre-fetched row or fall back to the ensured session. */
export function sessionMetaFromEnsuredSession(
  sessionRow: WaiterTableSessionRow | null,
  ensured: TableSessionRef,
  openedByName?: string | null,
): WaiterTableSessionMeta {
  const fromRow = sessionMetaFromRow(sessionRow, openedByName);
  if (fromRow) return fromRow;
  return withOpenedByName(
    {
      sessionId: ensured.id,
      openedAt: ensured.opened_at,
      status: ensured.status as 'open' | 'billing',
    },
    openedByName,
  );
}

type RestaurantOpenerContext = {
  restaurantId: string;
  ownerId: string;
  restaurantName: string;
};

async function loadRestaurantOpenerContext(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantOpenerContext | null> {
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('owner_id, name')
    .eq('id', restaurantId)
    .maybeSingle();
  if (!restaurant?.owner_id || !restaurant.name) return null;
  return {
    restaurantId,
    ownerId: restaurant.owner_id as string,
    restaurantName: restaurant.name as string,
  };
}

/** Active board sessions → meta map with resolved opener display names. */
export async function buildActiveSessionMetaByTableId(
  admin: SupabaseClient,
  restaurantId: string,
  sessions: WaiterTableSessionRow[],
): Promise<Record<string, WaiterTableSessionMeta>> {
  const openerIds = sessions
    .map((session) => session.opened_by_user_id)
    .filter((userId): userId is string => Boolean(userId));
  if (openerIds.length === 0) {
    return sessionMetaByTableIdFromSessions(sessions);
  }

  const restaurant = await loadRestaurantOpenerContext(admin, restaurantId);
  if (!restaurant) {
    return sessionMetaByTableIdFromSessions(sessions);
  }

  const openedByNameByUserId = await resolveOpenedByNames(admin, {
    restaurantId: restaurant.restaurantId,
    ownerId: restaurant.ownerId,
    restaurantName: restaurant.restaurantName,
    userIds: openerIds,
  });
  return sessionMetaByTableIdFromSessions(sessions, openedByNameByUserId);
}

/** Resolve opener display name for a single active session (e.g. after open-table mutation). */
export async function resolveActiveSessionOpenedByName(
  admin: SupabaseClient,
  restaurantId: string,
  openedByUserId: string | null | undefined,
): Promise<string | null> {
  if (!openedByUserId) return null;
  const restaurant = await loadRestaurantOpenerContext(admin, restaurantId);
  if (!restaurant) return null;
  return resolveOpenedByName(admin, {
    restaurantId: restaurant.restaurantId,
    ownerId: restaurant.ownerId,
    restaurantName: restaurant.restaurantName,
    userId: openedByUserId,
  });
}
