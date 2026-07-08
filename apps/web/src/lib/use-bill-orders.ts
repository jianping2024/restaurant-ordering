'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deriveBillView, syncCustomerBill } from '@/lib/customer-bill-sync';
import type { Order } from '@/types';

export function useBillOrders(
  initialOrders: Order[],
  params: { slug: string; tableId: string },
) {
  const [orders, setOrders] = useState(initialOrders);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInFlightRef = useRef<Promise<Order[] | null> | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const { orderLines, lineSpecs, total } = useMemo(() => deriveBillView(orders), [orders]);

  const refreshOrders = useCallback(async (): Promise<Order[] | null> => {
    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }

    const promise = (async () => {
      setIsSyncing(true);
      try {
        const synced = await syncCustomerBill(params.slug, params.tableId);
        return synced?.orders ?? null;
      } finally {
        setIsSyncing(false);
        syncInFlightRef.current = null;
      }
    })();

    syncInFlightRef.current = promise;
    return promise;
  }, [params.slug, params.tableId]);

  const commitOrders = useCallback((next: Order[]) => {
    setOrders(next);
  }, []);

  const syncOrders = useCallback(async (): Promise<Order[] | null> => {
    const fresh = await refreshOrders();
    if (fresh) commitOrders(fresh);
    return fresh;
  }, [refreshOrders, commitOrders]);

  // Client navigations (menu → bill) may reuse a stale RSC payload; reconcile on entry in background.
  useEffect(() => {
    void syncOrders();
  }, [syncOrders]);

  return {
    orders,
    orderLines,
    lineSpecs,
    total,
    isSyncing,
    refreshOrders,
    commitOrders,
    syncOrders,
  };
}
