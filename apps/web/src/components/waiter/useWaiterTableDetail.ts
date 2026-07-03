'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchWaiterTableDetailClient } from '@/lib/staff-board-client';
import { useRestaurantRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import {
  activeSessionIdByTableIdFromMeta,
  demoSessionMetaFromOrders,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterTableDetailData } from '@/lib/staff-board';

/**
 * Table detail client state.
 *
 * Production data: one staff API load on mount, then Realtime debounced reloads.
 * Mutations (buffet open, decrement) apply API snapshots via applyDetail.
 */
export function useWaiterTableDetail(
  restaurant: { id: string; slug: string },
  tableId: string,
  enabled: boolean,
  isDemo: boolean,
  demoTables: RestaurantTableRow[] = [],
  demoOrders: Order[] = [],
) {
  const [table, setTable] = useState<RestaurantTableRow | null>(null);
  const [orderRows, setOrderRows] = useState<Order[]>(isDemo ? demoOrders : []);
  const [sessionMeta, setSessionMeta] = useState<WaiterTableSessionMeta | null>(null);
  const [checkoutRequested, setCheckoutRequested] = useState(false);
  const [checkoutRequestedAt, setCheckoutRequestedAt] = useState<string | null>(null);
  const [detailLoaded, setDetailLoaded] = useState(isDemo);
  const supabase = useMemo(() => createClient(), []);
  const reloadSeqRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<WaiterTableDetailData | null> | null>(null);

  const demoSessionMetaByTableId = useMemo(
    () => (isDemo ? demoSessionMetaFromOrders(demoOrders) : {}),
    [isDemo, demoOrders],
  );

  const sessionMetaByTableId = useMemo(() => {
    if (isDemo) return demoSessionMetaByTableId;
    if (!sessionMeta) return {};
    return { [tableId]: sessionMeta };
  }, [isDemo, demoSessionMetaByTableId, sessionMeta, tableId]);

  const activeSessionByTableId = useMemo(() => {
    if (isDemo) return activeSessionIdByTableIdFromMeta(demoSessionMetaByTableId);
    return activeSessionIdByTableIdFromMeta(sessionMetaByTableId);
  }, [isDemo, demoSessionMetaByTableId, sessionMetaByTableId]);

  const applyDetail = useCallback((detail: WaiterTableDetailData) => {
    setTable(detail.table);
    setOrderRows(detail.orders);
    setSessionMeta(detail.sessionMeta);
    setCheckoutRequested(detail.checkoutRequested);
    setCheckoutRequestedAt(detail.checkoutRequestedAt);
    setDetailLoaded(true);
    return detail;
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const seq = ++reloadSeqRef.current;
    const running = (async () => {
      try {
        const detail = await fetchWaiterTableDetailClient(restaurant.slug, tableId);
        if (seq !== reloadSeqRef.current) return null;
        return applyDetail(detail);
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = running;
    return running;
  }, [applyDetail, enabled, restaurant.slug, tableId]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  useRestaurantRealtimeRefresh(
    supabase,
    restaurant.id,
    `waiter-table-${restaurant.id}-${tableId}`,
    enabled,
    () => {
      void refresh();
    },
    1200,
  );

  const resolvedTable = useMemo(() => {
    if (isDemo) return demoTables.find((row) => row.id === tableId) ?? null;
    return table;
  }, [demoTables, isDemo, table, tableId]);

  const orders = useMemo(() => {
    if (!isDemo) return orderRows;
    return ordersForWaiterTableView(tableId, demoOrders, activeSessionByTableId);
  }, [activeSessionByTableId, demoOrders, isDemo, orderRows, tableId]);

  return {
    table: resolvedTable,
    orders,
    sessionMeta,
    sessionMetaByTableId,
    activeSessionByTableId,
    checkoutRequested,
    checkoutRequestedAt,
    detailLoaded,
    refresh,
    applyDetail,
    supabase,
    demoTables: isDemo ? demoTables : [],
  };
}
