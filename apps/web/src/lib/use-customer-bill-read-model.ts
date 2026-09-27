'use client';

/**
 * Sole customer BillPage read-model: entry / visibility reconcile via {@link syncCustomerBill}.
 * One snapshot = orders + existing_split + collected_payments + session status (same as SSR).
 * Soft menu→bill must not keep a frozen half shell; do not gate reconcile on submitted.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shouldShowCheckoutSubmitted } from '@/lib/checkout-split-continuation';
import {
  deriveBillView,
  syncCustomerBill,
  type CustomerBillSyncSnapshot,
} from '@/lib/customer-bill-sync';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-staff-entry-reconcile';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { BillSplit, Order, SessionStatus } from '@/types';

export type BillOrdersRefresh = {
  orders: Order[];
  partyMemberCount: number;
};

export function useCustomerBillReadModel(
  initial: {
    orders: Order[];
    partyMemberCount?: number;
    existingSplit: BillSplit | null;
    collectedPayments: SessionCollectedPayment[];
    sessionStatus: SessionStatus;
  },
  params: {
    slug: string;
    tableId: string;
    /** Always reconcile on bill surfaces (incl. success page) so resume flips without hard reload. */
    enabled?: boolean;
  },
) {
  const enabled = params.enabled ?? true;
  const [orders, setOrders] = useState(initial.orders);
  const [partyMemberCount, setPartyMemberCount] = useState(
    () => initial.partyMemberCount ?? 0,
  );
  const [existingSplit, setExistingSplit] = useState<BillSplit | null>(initial.existingSplit);
  const [collectedPayments, setCollectedPayments] = useState(initial.collectedPayments);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(initial.sessionStatus);
  const [submitted, setSubmitted] = useState(() =>
    shouldShowCheckoutSubmitted(initial.existingSplit, initial.sessionStatus),
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const syncInFlightRef = useRef<Promise<CustomerBillSyncSnapshot | null> | null>(null);
  const callBillBusyRef = useRef(false);

  const markSynced = useCallback(() => {
    setLastSyncedAt(Date.now());
  }, []);

  useEffect(() => {
    setOrders(initial.orders);
  }, [initial.orders]);

  useEffect(() => {
    if (initial.partyMemberCount == null) return;
    setPartyMemberCount(initial.partyMemberCount);
  }, [initial.partyMemberCount]);

  useEffect(() => {
    setExistingSplit(initial.existingSplit);
    setCollectedPayments(initial.collectedPayments);
    setSessionStatus(initial.sessionStatus);
    if (!callBillBusyRef.current) {
      setSubmitted(
        shouldShowCheckoutSubmitted(initial.existingSplit, initial.sessionStatus),
      );
    }
  }, [initial.existingSplit, initial.collectedPayments, initial.sessionStatus]);

  const { orderLines, splitOrderLines, lineSpecs, total } = useMemo(
    () => deriveBillView(orders),
    [orders],
  );

  const applySnapshot = useCallback(
    (synced: CustomerBillSyncSnapshot) => {
      setOrders(synced.orders);
      setPartyMemberCount(synced.partyMemberCount);
      setExistingSplit(synced.existingSplit);
      setCollectedPayments(synced.collectedPayments);
      if (synced.sessionStatus) setSessionStatus(synced.sessionStatus);
      if (!callBillBusyRef.current) {
        setSubmitted(
          shouldShowCheckoutSubmitted(synced.existingSplit, synced.sessionStatus),
        );
      }
      markSynced();
    },
    [markSynced],
  );

  const refreshBill = useCallback(async (): Promise<CustomerBillSyncSnapshot | null> => {
    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }

    const promise = (async () => {
      setIsSyncing(true);
      try {
        const synced = await syncCustomerBill(params.slug, params.tableId);
        if (!synced) return null;
        applySnapshot(synced);
        return synced;
      } finally {
        setIsSyncing(false);
        syncInFlightRef.current = null;
      }
    })();

    syncInFlightRef.current = promise;
    return promise;
  }, [applySnapshot, params.slug, params.tableId]);

  const commitOrders = useCallback((next: Order[]) => {
    setOrders(next);
  }, []);

  /** Call-bill gate: refresh then return orders slice (submit helpers). */
  const refreshOrders = useCallback(async (): Promise<BillOrdersRefresh | null> => {
    const synced = await refreshBill();
    if (!synced) return null;
    return { orders: synced.orders, partyMemberCount: synced.partyMemberCount };
  }, [refreshBill]);

  const syncOrders = useCallback(async (): Promise<BillOrdersRefresh | null> => {
    return refreshOrders();
  }, [refreshOrders]);

  const setCallBillBusy = useCallback((busy: boolean) => {
    callBillBusyRef.current = busy;
  }, []);

  const markCheckoutSubmitted = useCallback(() => {
    setSubmitted(true);
  }, []);

  // Entry + visibility: full bill truth (orders + split + ledger). Never disable for submitted.
  useRestaurantStaffEntryReconcile(enabled, refreshBill, params.tableId);

  return {
    orders,
    partyMemberCount,
    existingSplit,
    collectedPayments,
    sessionStatus,
    submitted,
    orderLines,
    splitOrderLines,
    lineSpecs,
    total,
    isSyncing,
    lastSyncedAt,
    refreshOrders,
    refreshBill,
    commitOrders,
    syncOrders,
    setCallBillBusy,
    markCheckoutSubmitted,
    setSubmitted,
  };
}
