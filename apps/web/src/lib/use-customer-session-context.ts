'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CustomerSessionContext } from '@/lib/customer-session-context';
import { requestCustomerSessionContext } from '@/lib/request-customer-context';
import type { Order, TableSession } from '@/types';

function stateFromContext(context: CustomerSessionContext | null | undefined) {
  const activeSession = (context?.active_session as TableSession | null) ?? null;
  const recentOrders = activeSession
    ? ((context?.recent_orders ?? []) as Order[])
    : [];
  return { activeSession, recentOrders };
}

export function useCustomerSessionContext(
  initialContext: CustomerSessionContext | null,
  params: { slug: string; tableId: string; isDemo?: boolean },
) {
  const seeded = stateFromContext(initialContext);
  const [activeSession, setActiveSession] = useState<TableSession | null>(seeded.activeSession);
  const [recentOrders, setRecentOrders] = useState<Order[]>(seeded.recentOrders);
  const [sessionResolved, setSessionResolved] = useState(
    (params.isDemo ?? false) || initialContext != null,
  );

  useEffect(() => {
    const next = stateFromContext(initialContext);
    setActiveSession(next.activeSession);
    setRecentOrders(next.recentOrders);
    if (initialContext != null) setSessionResolved(true);
  }, [initialContext]);

  const applyContext = useCallback((data: CustomerSessionContext | null) => {
    if (!data) return null;
    const next = stateFromContext(data);
    setActiveSession(next.activeSession);
    setRecentOrders(next.recentOrders);
    setSessionResolved(true);
    return data;
  }, []);

  const refresh = useCallback(async () => {
    const data = await requestCustomerSessionContext(params.slug, params.tableId);
    return applyContext(data);
  }, [applyContext, params.slug, params.tableId]);

  // Entry reconcile only when SSR did not seed session (aligns with waiter table initialModel).
  useEffect(() => {
    if (params.isDemo || initialContext != null) return;
    void refresh();
  }, [initialContext, params.isDemo, refresh]);

  return {
    activeSession,
    recentOrders,
    sessionResolved,
    refresh,
  };
}
