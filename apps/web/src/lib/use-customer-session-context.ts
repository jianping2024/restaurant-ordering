'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
  return { activeSession, recentOrders };
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
  const [sessionResolved, setSessionResolved] = useState(isDemo || hasAuthoritativeSeed);

  const contextRef = useRef<CustomerSessionContext | null>(bootContext);
  const refreshInFlightRef = useRef<InFlightRefresh | null>(null);
  const lastFreshAtRef = useRef(hasAuthoritativeSeed ? Date.now() : 0);
  const prevTableIdRef = useRef(params.tableId);

  const applyContext = useCallback(
    (data: CustomerSessionContext | null, scope: CustomerSessionScope) => {
      if (!data) return null;
      if (data.table_id !== params.tableId) return contextRef.current;

      const merged = applyCustomerSessionScopeMerge(contextRef.current, data, scope);
      contextRef.current = merged;
      lastFreshAtRef.current = Date.now();
      const next = stateFromContext(merged);
      setActiveSession(next.activeSession);
      setRecentOrders(next.recentOrders);
      setSessionResolved(true);
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

  useEffect(() => {
    if (prevTableIdRef.current === params.tableId) return;
    prevTableIdRef.current = params.tableId;
    refreshInFlightRef.current = null;
    lastFreshAtRef.current = 0;
    const nextBoot = resolveBootContext(params.tableId, initialContext);
    contextRef.current = nextBoot;
    const next = stateFromContext(nextBoot);
    setActiveSession(next.activeSession);
    setRecentOrders(next.recentOrders);
    const seededForTable =
      !isDemo && nextBoot != null && nextBoot.table_id === params.tableId;
    setSessionResolved(isDemo || seededForTable);
    if (seededForTable) lastFreshAtRef.current = Date.now();
  }, [initialContext, isDemo, params.tableId]);

  // SSR / published-model boot per table entry — omit initialContext from reconcile deps.
  useEffect(() => {
    const nextBoot = resolveBootContext(params.tableId, initialContext);
    contextRef.current = nextBoot;
    const next = stateFromContext(nextBoot);
    setActiveSession(next.activeSession);
    setRecentOrders(next.recentOrders);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot on tableId/mount only
  }, [params.tableId]);

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

  useRestaurantStaffEntryReconcile(
    !isDemo,
    resumeRefresh,
    params.tableId,
    !hasAuthoritativeSeed,
  );

  return {
    activeSession,
    recentOrders,
    sessionResolved,
    refresh,
    isSessionContextFresh,
  };
}
