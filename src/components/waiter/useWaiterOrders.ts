'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchCheckoutRequestedTables, fetchWaiterBoardOrders } from '@/components/waiter/waiter-board-queries';

export function useWaiterOrders(
  restaurantId: string,
  initialOrders: Order[],
  initialCheckoutRequestedTables: number[],
  enabled: boolean,
  isDemo: boolean,
) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [checkoutRequestedTables, setCheckoutRequestedTables] = useState<number[]>(initialCheckoutRequestedTables);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!enabled || isDemo) return;

    const refresh = async () => {
      const [nextOrders, nextCheckoutRequestedTables] = await Promise.all([
        fetchWaiterBoardOrders(supabase, restaurantId),
        fetchCheckoutRequestedTables(supabase, restaurantId),
      ]);
      setOrders(nextOrders);
      setCheckoutRequestedTables(nextCheckoutRequestedTables);
    };

    void refresh();

    const channel = supabase
      .channel(`waiter-${restaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_sessions',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bill_splits',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    const pollTimer = window.setInterval(() => {
      void refresh();
    }, 5000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, isDemo, restaurantId, supabase]);

  return { orders, setOrders, checkoutRequestedTables, supabase };
}
