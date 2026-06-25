'use client';

import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchWaiterBoardClient } from '@/lib/staff-board-client';
import { useRestaurantRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';
import type {
  RestaurantTableGroup,
  RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import {
  activeSessionIdByTableIdFromMeta,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';

export function useWaiterOrders(
  restaurant: { id: string; slug: string },
  initialOrders: Order[],
  initialCheckoutRequestedTableIds: string[],
  initialTables: RestaurantTableRow[],
  enabled: boolean,
) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [checkoutRequestedTableIds, setCheckoutRequestedTableIds] = useState<string[]>(
    initialCheckoutRequestedTableIds,
  );
  const [sessionMetaByTableId, setSessionMetaByTableId] = useState<
    Record<string, WaiterTableSessionMeta>
  >({});
  const [checkoutRequestedAtByTableId, setCheckoutRequestedAtByTableId] = useState<
    Record<string, string>
  >({});
  const [tables, setTables] = useState<RestaurantTableRow[]>(initialTables);
  const [groups, setGroups] = useState<RestaurantTableGroup[]>([]);
  const [members, setMembers] = useState<RestaurantTableGroupMember[]>([]);
  const [tablesLoaded, setTablesLoaded] = useState(initialTables.length > 0);
  const supabase = useMemo(() => createClient(), []);
  const activeSessionByTableId = useMemo(
    () => activeSessionIdByTableIdFromMeta(sessionMetaByTableId),
    [sessionMetaByTableId],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    const board = await fetchWaiterBoardClient(restaurant.slug);
    setOrders(board.orders);
    setSessionMetaByTableId(board.sessionMetaByTableId);
    setCheckoutRequestedTableIds(board.checkoutRequestedTableIds);
    setCheckoutRequestedAtByTableId(board.checkoutRequestedAtByTableId);
    setTables(board.tables);
    setGroups(board.groups);
    setMembers(board.members);
    setTablesLoaded(true);
    return board;
  }, [enabled, restaurant.slug]);

  useRestaurantRealtimeRefresh(
    supabase,
    restaurant.id,
    `waiter-${restaurant.id}`,
    enabled,
    refresh,
    1200,
  );

  return {
    orders,
    setOrders,
    checkoutRequestedTableIds,
    activeSessionByTableId,
    sessionMetaByTableId,
    checkoutRequestedAtByTableId,
    tables,
    groups,
    members,
    tablesLoaded,
    refresh,
    supabase,
  };
}
