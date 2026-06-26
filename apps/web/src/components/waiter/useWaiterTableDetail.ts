'use client';

import { useCallback, useMemo, useState } from 'react';
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

type InitialDetail = {
  table?: RestaurantTableRow | null;
  orders?: Order[];
  sessionMeta?: WaiterTableSessionMeta | null;
  checkoutRequested?: boolean;
  checkoutRequestedAt?: string | null;
};

export function useWaiterTableDetail(
  restaurant: { id: string; slug: string },
  tableId: string,
  initial: InitialDetail | null,
  enabled: boolean,
  isDemo: boolean,
  demoTables: RestaurantTableRow[] = [],
  demoOrders: Order[] = [],
) {
  const hasInitialDetail = !!initial?.table;
  const [table, setTable] = useState<RestaurantTableRow | null>(initial?.table ?? null);
  const [orders, setOrders] = useState<Order[]>(
    isDemo ? demoOrders : (initial?.orders ?? []),
  );
  const [sessionMeta, setSessionMeta] = useState<WaiterTableSessionMeta | null>(
    initial?.sessionMeta ?? null,
  );
  const [checkoutRequested, setCheckoutRequested] = useState(!!initial?.checkoutRequested);
  const [checkoutRequestedAt, setCheckoutRequestedAt] = useState<string | null>(
    initial?.checkoutRequestedAt ?? null,
  );
  const [detailLoaded, setDetailLoaded] = useState(hasInitialDetail || isDemo);
  const supabase = useMemo(() => createClient(), []);

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
    setOrders(detail.orders);
    setSessionMeta(detail.sessionMeta);
    setCheckoutRequested(detail.checkoutRequested);
    setCheckoutRequestedAt(detail.checkoutRequestedAt);
    setDetailLoaded(true);
    return detail;
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    const detail = await fetchWaiterTableDetailClient(restaurant.slug, tableId);
    return applyDetail(detail);
  }, [applyDetail, enabled, restaurant.slug, tableId]);

  useRestaurantRealtimeRefresh(
    supabase,
    restaurant.id,
    `waiter-table-${restaurant.id}-${tableId}`,
    enabled,
    refresh,
    1200,
    hasInitialDetail,
  );

  const resolvedTable = useMemo(() => {
    if (isDemo) return demoTables.find((row) => row.id === tableId) ?? null;
    return table;
  }, [demoTables, isDemo, table, tableId]);

  const resolvedOrders = useMemo(() => {
    if (!isDemo) return orders;
    return ordersForWaiterTableView(tableId, demoOrders, activeSessionByTableId);
  }, [activeSessionByTableId, demoOrders, isDemo, orders, tableId]);

  return {
    table: resolvedTable,
    orders: resolvedOrders,
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
