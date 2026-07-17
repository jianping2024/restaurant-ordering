'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deriveBillView, syncCustomerBill } from '@/lib/customer-bill-sync';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-realtime-refresh';
import type { Order } from '@/types';

export type BillOrdersRefresh = {
  orders: Order[];
  partyMemberCount: number;
};

/**
 * Customer bill order read-model: one authority path (`syncOrders` → customer/bill).
 * Triggers: entry / visibility resume / call-bill gate — no visible-tab polling
 * (aligned with MenuPage and checkout-resume docs).
 */
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
