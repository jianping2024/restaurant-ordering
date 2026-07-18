'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shouldShowCheckoutSubmitted } from '@/lib/checkout-split-continuation';
import {
  initialPersistedSplitResult,
} from '@/lib/customer-bill-split-display';
import { deriveBillView, syncCustomerBill } from '@/lib/customer-bill-sync';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-realtime-refresh';
import type { BillSplit, Order, SessionStatus, SplitResult } from '@/types';

export type BillOrdersRefresh = {
  orders: Order[];
  partyMemberCount: number;
  sessionStatus: SessionStatus | null;
  sessionId: string | null;
  existingSplit: BillSplit | null;
  collectedPayments: SessionCollectedPayment[];
};

/**
 * Customer bill reconcile authority: refresh path returns orders + checkout freshness
 * (session status, split, collected payments). Triggers: entry / visibility resume.
 */
export function useBillOrders(
  initialOrders: Order[],
  params: {
    slug: string;
    tableId: string;
    initialPartyMemberCount?: number;
    initialSessionStatus: SessionStatus;
    initialSessionId: string | null;
    initialExistingSplit: BillSplit | null;
    initialCollectedPayments?: SessionCollectedPayment[];
  },
) {
  const [orders, setOrders] = useState(initialOrders);
  const [partyMemberCount, setPartyMemberCount] = useState(
    () => params.initialPartyMemberCount ?? 0,
  );
  const [sessionStatus, setSessionStatus] = useState(params.initialSessionStatus);
  const [sessionId, setSessionId] = useState(params.initialSessionId);
  const [existingSplit, setExistingSplit] = useState(params.initialExistingSplit);
  const [collectedPayments, setCollectedPayments] = useState<SessionCollectedPayment[]>(
    () => params.initialCollectedPayments ?? [],
  );
  const [submitted, setSubmitted] = useState(() =>
    shouldShowCheckoutSubmitted(params.initialExistingSplit, params.initialSessionStatus),
  );
  const [persistedResult, setPersistedResult] = useState<SplitResult[] | null>(() =>
    initialPersistedSplitResult(
      params.initialExistingSplit?.result as SplitResult[] | null,
      shouldShowCheckoutSubmitted(params.initialExistingSplit, params.initialSessionStatus),
    ),
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const syncInFlightRef = useRef<Promise<BillOrdersRefresh | null> | null>(null);

  const markOrdersSynced = useCallback(() => {
    setLastSyncedAt(Date.now());
  }, []);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    if (params.initialPartyMemberCount == null) return;
    setPartyMemberCount(params.initialPartyMemberCount);
  }, [params.initialPartyMemberCount]);

  const { orderLines, lineSpecs, total } = useMemo(() => deriveBillView(orders), [orders]);

  const applyRefresh = useCallback((fresh: BillOrdersRefresh) => {
    setPartyMemberCount(fresh.partyMemberCount);
    setSessionStatus(fresh.sessionStatus ?? params.initialSessionStatus);
    setSessionId(fresh.sessionId);
    setExistingSplit(fresh.existingSplit);
    setCollectedPayments(fresh.collectedPayments);
    const nextSubmitted = shouldShowCheckoutSubmitted(
      fresh.existingSplit,
      fresh.sessionStatus ?? params.initialSessionStatus,
    );
    setSubmitted(nextSubmitted);
    setPersistedResult(
      initialPersistedSplitResult(
        fresh.existingSplit?.result as SplitResult[] | null,
        nextSubmitted,
      ),
    );
    markOrdersSynced();
  }, [markOrdersSynced, params.initialSessionStatus]);

  const refreshOrders = useCallback(async (): Promise<BillOrdersRefresh | null> => {
    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }

    const promise = (async () => {
      setIsSyncing(true);
      try {
        const synced = await syncCustomerBill(params.slug, params.tableId);
        if (!synced?.orders) return null;
        const fresh: BillOrdersRefresh = {
          orders: synced.orders,
          partyMemberCount: synced.party_member_count,
          sessionStatus: synced.session_status,
          sessionId: synced.session_id,
          existingSplit: synced.existing_split,
          collectedPayments: synced.collected_payments,
        };
        applyRefresh(fresh);
        return fresh;
      } finally {
        setIsSyncing(false);
        syncInFlightRef.current = null;
      }
    })();

    syncInFlightRef.current = promise;
    return promise;
  }, [applyRefresh, params.slug, params.tableId]);

  const commitOrders = useCallback((next: Order[]) => {
    setOrders(next);
  }, []);

  const syncOrders = useCallback(async (): Promise<BillOrdersRefresh | null> => {
    const fresh = await refreshOrders();
    if (fresh) commitOrders(fresh.orders);
    return fresh;
  }, [refreshOrders, commitOrders]);

  useRestaurantStaffEntryReconcile(true, syncOrders, params.tableId);

  return {
    orders,
    partyMemberCount,
    sessionStatus,
    sessionId,
    existingSplit,
    collectedPayments,
    submitted,
    setSubmitted,
    persistedResult,
    setPersistedResult,
    orderLines,
    lineSpecs,
    total,
    isSyncing,
    lastSyncedAt,
    refreshOrders,
    commitOrders,
    syncOrders,
  };
}
