'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deriveBillView, syncCustomerBill } from '@/lib/customer-bill-sync';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-realtime-refresh';
import type { Order } from '@/types';

export type BillOrdersRefresh = {
  orders: Order[];
  partyMemberCount: number;
};

/** While the bill page stays visible, pull authority via the same syncOrders path (customers cannot RLS-subscribe to orders). */
const BILL_ORDERS_VISIBLE_POLL_MS = 2500;

export function useBillOrders(
  initialOrders: Order[],
  params: {
    slug: string;
    tableId: string;
    initialPartyMemberCount?: number;
  },
) {
  const [orders, setOrders] = useState(initialOrders);
  const [partyMemberCount, setPartyMemberCount] = useState(
    () => params.initialPartyMemberCount ?? 0,
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const syncInFlightRef = useRef<Promise<BillOrdersRefresh | null> | null>(null);

  const markOrdersSynced = useCallback(() => {
    setLastSyncedAt(Date.now());
  }, []);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    if (params.initialPartyMemberCount == null) return;
    setPartyMemberCount(params.initialPartyMemberCount);
  }, [params.initialPartyMemberCount]);

  const { orderLines, lineSpecs, total } = useMemo(() => deriveBillView(orders), [orders]);

  const refreshOrders = useCallback(async (): Promise<BillOrdersRefresh | null> => {
    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }

    const promise = (async () => {
      setIsSyncing(true);
      try {
        const synced = await syncCustomerBill(params.slug, params.tableId);
        if (!synced?.orders) return null;
        setPartyMemberCount(synced.partyMemberCount);
        markOrdersSynced();
        return {
          orders: synced.orders,
          partyMemberCount: synced.partyMemberCount,
        };
      } finally {
        setIsSyncing(false);
        syncInFlightRef.current = null;
      }
    })();

    syncInFlightRef.current = promise;
    return promise;
  }, [markOrdersSynced, params.slug, params.tableId]);

  const commitOrders = useCallback((next: Order[]) => {
    setOrders(next);
  }, []);

  const syncOrders = useCallback(async (): Promise<BillOrdersRefresh | null> => {
    const fresh = await refreshOrders();
    if (fresh) commitOrders(fresh.orders);
    return fresh;
  }, [refreshOrders, commitOrders]);

  // Entry + visibility resume: same syncOrders authority (menu → bill may reuse stale RSC).
  useRestaurantStaffEntryReconcile(true, syncOrders, params.tableId);

  // Visible poll: customers have no orders Realtime (RLS); keep one sync path while the tab is open.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const clear = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const arm = () => {
      if (timer || document.visibilityState !== 'visible') return;
      timer = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        void syncOrders();
      }, BILL_ORDERS_VISIBLE_POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') arm();
      else clear();
    };

    arm();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clear();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [syncOrders]);

  return {
    orders,
    partyMemberCount,
    orderLines,
    lineSpecs,
    total,
    isSyncing,
    lastSyncedAt,
    refreshOrders,
    commitOrders,
    syncOrders,
  };
}
