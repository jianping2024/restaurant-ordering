'use client';

import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchWaiterBoardClient } from '@/lib/staff-board-client';
import { useRestaurantRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  activeSessionIdByTableIdFromMeta,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';

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
    tablesLoaded,
    refresh,
    supabase,
  };
}
