'use client';

import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchWaiterBoardClient } from '@/lib/staff-board-client';
import { useRestaurantRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';
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
  const [activeSessionTableIds, setActiveSessionTableIds] = useState<string[]>([]);
  const [tables, setTables] = useState<RestaurantTableRow[]>(initialTables);
  const [tablesLoaded, setTablesLoaded] = useState(initialTables.length > 0);
  const supabase = useMemo(() => createClient(), []);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    const board = await fetchWaiterBoardClient(restaurant.slug);
    setOrders(board.orders);
    setActiveSessionTableIds(board.activeSessionTableIds);
    setCheckoutRequestedTableIds(board.checkoutRequestedTableIds);
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
    activeSessionTableIds,
    tables,
    tablesLoaded,
    refresh,
    supabase,
  };
}
