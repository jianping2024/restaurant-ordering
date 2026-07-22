'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchWaiterTablePageModelClient } from '@/lib/staff-board-client';
import {
  useDebouncedPostgresRealtimeRefresh,
  useRestaurantStaffEntryReconcile,
} from '@/lib/use-restaurant-realtime-refresh';
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
import {
  commitAuthoritativeWaiterTablePageModel,
  peekPublishedWaiterTablePageModel,
} from '@/lib/waiter-staff-mutation-sync';
import type { WaiterBoardOpenTableDefaults } from '@/lib/waiter-board-open-table';
import {
  attachOpenTableDefaultsToPageModel,
  type WaiterTableDetailFetchScope,
} from '@/lib/waiter-table-detail-scope';

function resolveTableDetailBootModel(
  tableId: string,
  initialModel?: WaiterTablePageModel | null,
): WaiterTablePageModel | null {
  return peekPublishedWaiterTablePageModel(tableId) ?? initialModel ?? null;
}

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
 * 1. Boot seed — published mutation cache, idle board open-table seed, optional SSR/demo
 * 2. Entry reconcile — Staff API on mount / tableId change (skipped when boot authoritative)
 * 3. menu_submit return — Staff API reconcile, then strip query
 * 4. Realtime while mounted — debounced refresh for this tableId
 *
 * When board open-table defaults exist, occupancy pulls use scope=live and re-attach defaults
 * (one price source — board full seed), avoiding buffet/price RPC on every doorbell.
 */
export function useWaiterTableDetail(
  restaurant: { id: string; slug: string },
  tableId: string,
  enabled: boolean,
  isDemo: boolean,
  demoTables: RestaurantTableRow[] = [],
  demoOrders: Order[] = [],
  initialModel?: WaiterTablePageModel | null,
  skipEntryReconcile = false,
  openTableDefaults: WaiterBoardOpenTableDefaults | null = null,
) {
  const bootModel = resolveTableDetailBootModel(tableId, initialModel);
  const hasAuthoritativeBoot = bootModel?.detail.table != null;
  const reconcileOnMount = !skipEntryReconcile && !hasAuthoritativeBoot;
  const detailFetchScope: WaiterTableDetailFetchScope =
    openTableDefaults != null ? 'live' : 'full';

  const boot = detailFromModel(bootModel);
  const [model, setModel] = useState<WaiterTablePageModel | null>(bootModel);
  const [table, setTable] = useState(boot.table);
  const [orderRows, setOrderRows] = useState<Order[]>(isDemo ? demoOrders : boot.orderRows);
  const [sessionMeta, setSessionMeta] = useState(boot.sessionMeta);
  const [checkoutRequested, setCheckoutRequested] = useState(boot.checkoutRequested);
  const [checkoutRequestedAt, setCheckoutRequestedAt] = useState(boot.checkoutRequestedAt);
  const [detailLoaded, setDetailLoaded] = useState(isDemo || !!bootModel?.detail.table);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reloadSeqRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<WaiterTablePageModel | null> | null>(null);
  const staffReturnSyncRef = useRef(false);
  const prevTableIdRef = useRef(tableId);
  const openTableDefaultsRef = useRef(openTableDefaults);
  openTableDefaultsRef.current = openTableDefaults;

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
    const scope: WaiterTableDetailFetchScope =
      openTableDefaultsRef.current != null ? 'live' : 'full';
    const running = (async (): Promise<WaiterTablePageModel | null> => {
      try {
        const fetched = await fetchWaiterTablePageModelClient(restaurant.slug, tableId, scope);
        const nextModel = attachOpenTableDefaultsToPageModel(
          fetched,
          openTableDefaultsRef.current,
        );
        if (seq !== reloadSeqRef.current) return null;
        const normalized = applyModel(nextModel);
        commitAuthoritativeWaiterTablePageModel(normalized);
        return normalized;
      } catch {
        if (seq !== reloadSeqRef.current) return null;
        setModel(null);
        setTable(null);
        setOrderRows([]);
        setSessionMeta(null);
        setCheckoutRequested(false);
        setCheckoutRequestedAt(null);
        setDetailLoaded(true);
        return null;
      } finally {
        if (reloadSeqRef.current === seq) {
          refreshInFlightRef.current = null;
        }
      }
    })();
    refreshInFlightRef.current = running;
    return running;
  }, [applyModel, enabled, restaurant.slug, tableId]);

  useEffect(() => {
    if (prevTableIdRef.current === tableId) return;
    prevTableIdRef.current = tableId;
    reloadSeqRef.current += 1;
    refreshInFlightRef.current = null;
    setModel(null);
    setTable(null);
    setOrderRows([]);
    setSessionMeta(null);
    setCheckoutRequested(false);
    setCheckoutRequestedAt(null);
    setDetailLoaded(false);
  }, [tableId]);

  // Boot seed per table entry — published / idle board / SSR; omit initialModel from deps.
  useEffect(() => {
    const seed = resolveTableDetailBootModel(tableId, initialModel);
    if (!seed?.detail.table) return;
    applyModel(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on tableId/mount only
  }, [applyModel, tableId]);

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
    enabled && !isDemo && !staffMenuSubmitReturn,
    refresh,
    tableId,
    reconcileOnMount,
  );

  const tableFilter = `table_id=eq.${tableId}`;
  useDebouncedPostgresRealtimeRefresh(
    supabase,
    `waiter-table-${restaurant.id}-${tableId}`,
    enabled && !isDemo,
    [
      { table: 'orders', filter: tableFilter },
      { table: 'table_sessions', filter: tableFilter },
      { table: 'bill_splits', filter: tableFilter },
    ],
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
    return ordersForWaiterTableView(tableId, orderRows, activeSessionByTableId);
  }, [activeSessionByTableId, isDemo, orderRows, tableId]);

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
    detailFetchScope,
  };
}
