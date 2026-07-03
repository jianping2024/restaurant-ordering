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

function clientStateFromDetail(detail: WaiterTableDetailData | null | undefined) {
  if (!detail) {
    return {
      table: null as RestaurantTableRow | null,
      orderRows: [] as Order[],
      sessionMeta: null as WaiterTableSessionMeta | null,
      checkoutRequested: false,
      checkoutRequestedAt: null as string | null,
    };
  }
  return {
    table: detail.table,
    orderRows: detail.orders,
    sessionMeta: detail.sessionMeta,
    checkoutRequested: detail.checkoutRequested,
    checkoutRequestedAt: detail.checkoutRequestedAt,
  };
}

/**
 * Table detail client state.
 *
 * Production: SSR initialDetail hydrates first paint; Realtime + mutations refresh via staff API.
 * Demo: static props only.
 */
export function useWaiterTableDetail(
  restaurant: { id: string; slug: string },
  tableId: string,
  enabled: boolean,
  isDemo: boolean,
  demoTables: RestaurantTableRow[] = [],
  demoOrders: Order[] = [],
  initialDetail?: WaiterTableDetailData | null,
) {
  const boot = clientStateFromDetail(initialDetail);
  const [table, setTable] = useState(boot.table);
  const [orderRows, setOrderRows] = useState<Order[]>(isDemo ? demoOrders : boot.orderRows);
  const [sessionMeta, setSessionMeta] = useState(boot.sessionMeta);
  const [checkoutRequested, setCheckoutRequested] = useState(boot.checkoutRequested);
  const [checkoutRequestedAt, setCheckoutRequestedAt] = useState(boot.checkoutRequestedAt);
  const [detailLoaded, setDetailLoaded] = useState(isDemo || !!initialDetail);
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
    const next = clientStateFromDetail(detail);
    setTable(next.table);
    setOrderRows(next.orderRows);
    setSessionMeta(next.sessionMeta);
    setCheckoutRequested(next.checkoutRequested);
    setCheckoutRequestedAt(next.checkoutRequestedAt);
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
    if (initialDetail) {
      applyDetail(initialDetail);
      return;
    }
    setDetailLoaded(false);
    void refresh();
  }, [applyDetail, enabled, initialDetail, refresh, tableId]);

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
