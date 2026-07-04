'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchWaiterTablePageModelClient } from '@/lib/staff-board-client';
import { useRestaurantRealtimeRefresh, useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-realtime-refresh';
import { ordersForWaiterTableView } from '@/lib/waiter-table-orders';
import {
  isStaffAssistedMenuSubmitReturn,
  reconcileStaffAssistedMenuSubmitReturn,
} from '@/lib/staff-assisted-return-sync';
import {
  activeSessionIdByTableIdFromMeta,
  demoSessionMetaFromOrders,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { normalizeWaiterTablePageModel } from '@/lib/waiter-table-detail-normalize';

function detailFromModel(model: WaiterTablePageModel | null | undefined) {
  if (!model) {
    return {
      table: null as RestaurantTableRow | null,
      orderRows: [] as Order[],
      sessionMeta: null as WaiterTableSessionMeta | null,
      checkoutRequested: false,
      checkoutRequestedAt: null as string | null,
    };
  }
  return {
    table: model.detail.table,
    orderRows: model.detail.orders,
    sessionMeta: model.detail.sessionMeta,
    checkoutRequested: model.detail.checkoutRequested,
    checkoutRequestedAt: model.detail.checkoutRequestedAt,
  };
}

/**
 * Table detail client state — single WaiterTablePageModel source.
 *
 * Freshness layers:
 * 1. SSR seed — apply initialModel on mount / tableId change only (not on RSC prop refresh)
 * 2. Entry reconcile — Staff API when no SSR seed
 * 3. menu_submit return — Staff API reconcile, then strip query (client state wins over stale SSR)
 * 4. Realtime + mutations — applyModel via Staff API
 */
export function useWaiterTableDetail(
  restaurant: { id: string; slug: string },
  tableId: string,
  enabled: boolean,
  isDemo: boolean,
  demoTables: RestaurantTableRow[] = [],
  demoOrders: Order[] = [],
  initialModel?: WaiterTablePageModel | null,
) {
  const boot = detailFromModel(initialModel ?? null);
  const [model, setModel] = useState<WaiterTablePageModel | null>(initialModel ?? null);
  const [table, setTable] = useState(boot.table);
  const [orderRows, setOrderRows] = useState<Order[]>(isDemo ? demoOrders : boot.orderRows);
  const [sessionMeta, setSessionMeta] = useState(boot.sessionMeta);
  const [checkoutRequested, setCheckoutRequested] = useState(boot.checkoutRequested);
  const [checkoutRequestedAt, setCheckoutRequestedAt] = useState(boot.checkoutRequestedAt);
  const [detailLoaded, setDetailLoaded] = useState(isDemo || !!initialModel?.detail.table);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reloadSeqRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<WaiterTablePageModel | null> | null>(null);
  const staffReturnSyncRef = useRef(false);
  const prevTableIdRef = useRef(tableId);

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

  const applyModel = useCallback((nextModel: WaiterTablePageModel) => {
    const normalized = normalizeWaiterTablePageModel(nextModel);
    const next = detailFromModel(normalized);
    setModel(normalized);
    setTable(next.table);
    setOrderRows(next.orderRows);
    setSessionMeta(next.sessionMeta);
    setCheckoutRequested(next.checkoutRequested);
    setCheckoutRequestedAt(next.checkoutRequestedAt);
    setDetailLoaded(true);
    return normalized;
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const seq = ++reloadSeqRef.current;
    const running = (async () => {
      try {
        const nextModel = await fetchWaiterTablePageModelClient(restaurant.slug, tableId);
        if (seq !== reloadSeqRef.current) return null;
        return applyModel(nextModel);
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = running;
    return running;
  }, [applyModel, enabled, restaurant.slug, tableId]);

  useEffect(() => {
    if (prevTableIdRef.current !== tableId) {
      prevTableIdRef.current = tableId;
      reloadSeqRef.current += 1;
      refreshInFlightRef.current = null;
      setDetailLoaded(false);
    }
  }, [tableId]);

  // SSR seed per table entry — omit initialModel from deps so router.replace cannot clobber post-mutation client state.
  useEffect(() => {
    if (!initialModel?.detail.table) return;
    applyModel(initialModel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on tableId/mount only
  }, [applyModel, tableId]);

  useEffect(() => {
    if (!enabled || isDemo || initialModel) return;
    void refresh();
  }, [enabled, initialModel, isDemo, refresh, tableId]);

  const staffMenuSubmitReturn = isStaffAssistedMenuSubmitReturn(searchParams);

  useEffect(() => {
    if (!enabled || isDemo || !staffMenuSubmitReturn) return;
    if (staffReturnSyncRef.current) return;
    staffReturnSyncRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        await reconcileStaffAssistedMenuSubmitReturn({
          router,
          pathname,
          refreshDetail: refresh,
        });
      } finally {
        if (!cancelled) staffReturnSyncRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      staffReturnSyncRef.current = false;
    };
  }, [enabled, isDemo, pathname, refresh, router, staffMenuSubmitReturn, tableId]);

  useRestaurantStaffEntryReconcile(
    enabled && !staffMenuSubmitReturn && !initialModel,
    refresh,
    tableId,
  );

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
    model,
    sessionMeta,
    sessionMetaByTableId,
    activeSessionByTableId,
    checkoutRequested,
    checkoutRequestedAt,
    detailLoaded,
    refresh,
    applyModel,
    supabase,
    demoTables: isDemo ? demoTables : [],
  };
}
