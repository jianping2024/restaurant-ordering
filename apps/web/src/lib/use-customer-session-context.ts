'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  resolveCustomerSessionBootContext,
  type CustomerSessionContext,
} from '@/lib/customer-session-context';
import { requestCustomerSessionContext } from '@/lib/request-customer-context';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-realtime-refresh';
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

export function useCustomerSessionContext(
  initialContext: CustomerSessionContext | null,
  params: { slug: string; tableId: string; isDemo?: boolean },
) {
  const isDemo = params.isDemo ?? false;
  const bootContext = resolveBootContext(params.tableId, initialContext);
  const seeded = stateFromContext(bootContext);

  const [activeSession, setActiveSession] = useState<TableSession | null>(seeded.activeSession);
  const [recentOrders, setRecentOrders] = useState<Order[]>(seeded.recentOrders);
  const [sessionResolved, setSessionResolved] = useState(isDemo);

  const refreshInFlightRef = useRef<Promise<CustomerSessionContext | null> | null>(null);
  const prevTableIdRef = useRef(params.tableId);

  const applyContext = useCallback((data: CustomerSessionContext | null) => {
    if (!data) return null;
    const next = stateFromContext(data);
    setActiveSession(next.activeSession);
    setRecentOrders(next.recentOrders);
    setSessionResolved(true);
    return data;
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const running = (async () => {
      try {
        const data = await requestCustomerSessionContext(params.slug, params.tableId);
        return applyContext(data);
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = running;
    return running;
  }, [applyContext, params.slug, params.tableId]);

  useEffect(() => {
    if (prevTableIdRef.current === params.tableId) return;
    prevTableIdRef.current = params.tableId;
    refreshInFlightRef.current = null;
    const next = stateFromContext(resolveBootContext(params.tableId, initialContext));
    setActiveSession(next.activeSession);
    setRecentOrders(next.recentOrders);
    setSessionResolved(isDemo);
  }, [initialContext, isDemo, params.tableId]);

  // SSR / published-model boot per table entry — omit initialContext from reconcile deps.
  useEffect(() => {
    const next = stateFromContext(resolveBootContext(params.tableId, initialContext));
    setActiveSession(next.activeSession);
    setRecentOrders(next.recentOrders);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot on tableId/mount only
  }, [params.tableId]);

  useRestaurantStaffEntryReconcile(!isDemo, refresh, params.tableId);

  return {
    activeSession,
    recentOrders,
    sessionResolved,
    refresh,
  };
}
