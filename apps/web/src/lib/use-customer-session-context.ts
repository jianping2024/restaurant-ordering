'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  adoptCustomerSessionParentSeed,
  applyCustomerSessionScopeMerge,
  resolveCustomerSessionBootContext,
  type CustomerSessionContext,
  type CustomerSessionScope,
} from '@/lib/customer-session-context';
import { requestCustomerSessionContext } from '@/lib/request-customer-context';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-staff-entry-reconcile';
import { peekPublishedWaiterTablePageModel } from '@/lib/waiter-staff-mutation-sync';
import type { Order, TableSession } from '@/types';

function stateFromContext(context: CustomerSessionContext | null | undefined) {
  const activeSession = (context?.active_session as TableSession | null) ?? null;
  const recentOrders = activeSession
    ? ((context?.recent_orders ?? []) as Order[])
    : [];
  const kitchenProgress = activeSession ? (context?.kitchen_progress ?? null) : null;
  return { activeSession, recentOrders, kitchenProgress };
}

function resolveBootContext(
  tableId: string,
  ssrContext: CustomerSessionContext | null,
): CustomerSessionContext | null {
  return resolveCustomerSessionBootContext({
    tableId,
    ssrContext,
    publishedModel: peekPublishedWaiterTablePageModel(tableId),
  });
}

type InFlightRefresh = {
  scope: CustomerSessionScope;
  promise: Promise<CustomerSessionContext | null>;
  token: object;
};

/** Skip visibility/mount / submit sushi re-pull when a fresh context was applied recently. */
export const CUSTOMER_SESSION_RESUME_TTL_MS = 15_000;

function scopeCovers(running: CustomerSessionScope, requested: CustomerSessionScope) {
  return running === 'full' || requested === 'gate';
}

function paintFromContext(
  context: CustomerSessionContext | null,
  setters: {
    setActiveSession: (s: TableSession | null) => void;
    setRecentOrders: (o: Order[]) => void;
    setKitchenProgress: (k: CustomerSessionContext['kitchen_progress']) => void;
  },
) {
  const next = stateFromContext(context);
  setters.setActiveSession(next.activeSession);
  setters.setRecentOrders(next.recentOrders);
  setters.setKitchenProgress(next.kitchenProgress);
  return next;
}

export function useCustomerSessionContext(
  initialContext: CustomerSessionContext | null,
  params: {
    slug: string;
    tableId: string;
    isDemo?: boolean;
    /** Visibility / mount reconcile scope — full while ordered drawer is open. */
    resumeScope?: CustomerSessionScope;
  },
) {
  const isDemo = params.isDemo ?? false;
  const resumeScope: CustomerSessionScope = params.resumeScope ?? 'gate';
  const bootContext = resolveBootContext(params.tableId, initialContext);
  const seeded = stateFromContext(bootContext);
  const hasAuthoritativeSeed =
    !isDemo && bootContext != null && bootContext.table_id === params.tableId;

  const [activeSession, setActiveSession] = useState<TableSession | null>(seeded.activeSession);
  const [recentOrders, setRecentOrders] = useState<Order[]>(seeded.recentOrders);
  const [kitchenProgress, setKitchenProgress] = useState(seeded.kitchenProgress);
  const [sessionResolved, setSessionResolved] = useState(isDemo || hasAuthoritativeSeed);
  /**
   * Full-scope orders list is authoritative (SSR menu seed is full, or a successful `full` fetch).
   * Gate-only `recent_orders: []` must not count as ready — peer-float paid catchup waits on this.
   * Occupied chrome stub (session + empty orders) is also not ready until parent/full catch-up.
   */
  const [ordersSnapshotReady, setOrdersSnapshotReady] = useState(
    hasAuthoritativeSeed &&
      (!bootContext?.active_session || bootContext.recent_orders.length > 0),
  );

  const contextRef = useRef<CustomerSessionContext | null>(bootContext);
  const refreshInFlightRef = useRef<InFlightRefresh | null>(null);
  const lastFreshAtRef = useRef(
    hasAuthoritativeSeed &&
      (!bootContext?.active_session || bootContext.recent_orders.length > 0)
      ? Date.now()
      : 0,
  );
  const prevTableIdRef = useRef(params.tableId);
  const paintSetters = useRef({
    setActiveSession,
    setRecentOrders,
    setKitchenProgress,
  });
  paintSetters.current = { setActiveSession, setRecentOrders, setKitchenProgress };

  const applyContext = useCallback(
    (data: CustomerSessionContext | null, scope: CustomerSessionScope) => {
      if (!data) return null;
      if (data.table_id !== params.tableId) return contextRef.current;

      const previous = contextRef.current;
      const prevSessionId = previous?.active_session?.id ?? null;
      const merged = applyCustomerSessionScopeMerge(previous, data, scope);
      contextRef.current = merged;
      lastFreshAtRef.current = Date.now();
      paintFromContext(merged, paintSetters.current);
      setSessionResolved(true);
      if (scope === 'full') {
        setOrdersSnapshotReady(true);
      } else {
        const nextSessionId = merged.active_session?.id ?? null;
        if (nextSessionId !== prevSessionId) {
          setOrdersSnapshotReady(false);
        }
      }
      return merged;
    },
    [params.tableId],
  );

  const refresh = useCallback(
    async (scope: CustomerSessionScope = 'gate') => {
      const running = refreshInFlightRef.current;
      if (running && scopeCovers(running.scope, scope)) {
        return running.promise;
      }
      if (running) {
        // Upgrade gate → full: wait for gate to settle, then fetch full.
        await running.promise.catch(() => null);
      }

      const requestScope = scope;
      const token = {};
      const promise = (async () => {
        try {
          const data = await requestCustomerSessionContext(
            params.slug,
            params.tableId,
            requestScope,
          );
          return applyContext(data, requestScope);
        } finally {
          if (refreshInFlightRef.current?.token === token) {
            refreshInFlightRef.current = null;
          }
        }
      })();

      refreshInFlightRef.current = { scope: requestScope, promise, token };
      return promise;
    },
    [applyContext, params.slug, params.tableId],
  );

  // Sole seed path: table change resets from boot; same-table parent seed catch-up
  // adopts waiter-detail orders (empty chrome stub → Rodizio headcount) via
  // adoptCustomerSessionParentSeed — one representation, no second headcount source.
  useEffect(() => {
    const tableChanged = prevTableIdRef.current !== params.tableId;
    if (tableChanged) {
      prevTableIdRef.current = params.tableId;
      refreshInFlightRef.current = null;
      lastFreshAtRef.current = 0;
      const nextBoot = resolveBootContext(params.tableId, initialContext);
      contextRef.current = nextBoot;
      paintFromContext(nextBoot, paintSetters.current);
      const seededForTable =
        !isDemo && nextBoot != null && nextBoot.table_id === params.tableId;
      const ordersReady =
        seededForTable &&
        (!nextBoot?.active_session || nextBoot.recent_orders.length > 0);
      setSessionResolved(isDemo || seededForTable);
      setOrdersSnapshotReady(ordersReady);
      if (ordersReady) lastFreshAtRef.current = Date.now();
      return;
    }

    const previous = contextRef.current;
    const adopted = adoptCustomerSessionParentSeed(previous, initialContext, params.tableId);
    if (!adopted) return;
    if (
      previous &&
      adopted.active_session?.id === previous.active_session?.id &&
      adopted.recent_orders === previous.recent_orders &&
      adopted.display_name === previous.display_name
    ) {
      return;
    }
    contextRef.current = adopted;
    paintFromContext(adopted, paintSetters.current);
    setSessionResolved(true);
    if (adopted.recent_orders.length > 0) {
      setOrdersSnapshotReady(true);
      lastFreshAtRef.current = Date.now();
    }
  }, [initialContext, isDemo, params.tableId]);

  const isSessionContextFresh = useCallback(() => {
    return (
      contextRef.current != null &&
      contextRef.current.table_id === params.tableId &&
      Date.now() - lastFreshAtRef.current < CUSTOMER_SESSION_RESUME_TTL_MS
    );
  }, [params.tableId]);

  const resumeRefresh = useCallback(() => {
    if (isSessionContextFresh() && contextRef.current) {
      return Promise.resolve(contextRef.current);
    }
    return refresh(resumeScope);
  }, [isSessionContextFresh, refresh, resumeScope]);

  const needsOrdersPull =
    hasAuthoritativeSeed &&
    bootContext?.active_session != null &&
    bootContext.recent_orders.length === 0;

  useRestaurantStaffEntryReconcile(
    !isDemo,
    resumeRefresh,
    params.tableId,
    !hasAuthoritativeSeed || needsOrdersPull,
  );

  // Hidden tabs miss Realtime doorbells; invalidate resume TTL so visibility reconcile pulls.
  useEffect(() => {
    if (isDemo) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        lastFreshAtRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [isDemo]);

  return {
    activeSession,
    recentOrders,
    kitchenProgress,
    sessionResolved,
    ordersSnapshotReady,
    refresh,
    isSessionContextFresh,
  };
}
