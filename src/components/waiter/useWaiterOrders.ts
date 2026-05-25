'use client';

import { useCallback, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchWaiterBoardClient } from '@/lib/staff-board-client';
import { useRestaurantRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';

export function useWaiterOrders(
  restaurantId: string,
  initialOrders: Order[],
  initialCheckoutRequestedTables: string[],
  enabled: boolean,
) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [checkoutRequestedTables, setCheckoutRequestedTables] = useState<string[]>(
    initialCheckoutRequestedTables,
  );
  const [activeSessionTableNumbers, setActiveSessionTableNumbers] = useState<string[]>([]);
  const supabase = useMemo(() => createClient(), []);

  const refresh = useCallback(async () => {
    const board = await fetchWaiterBoardClient(restaurantId);
    setOrders(board.orders);
    setActiveSessionTableNumbers(board.activeSessionTableNumbers);
    setCheckoutRequestedTables(board.checkoutRequestedTables);
  }, [restaurantId]);

  useRestaurantRealtimeRefresh(
    supabase,
    restaurantId,
    `waiter-${restaurantId}`,
    enabled,
    refresh,
    1200,
  );

  return {
    orders,
    setOrders,
    checkoutRequestedTables,
    activeSessionTableNumbers,
    refresh,
    supabase,
  };
}
