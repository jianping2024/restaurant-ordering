'use client';

/**
 * Sole customer BillPage read-model: entry / visibility reconcile via {@link syncCustomerBill}.
 * One snapshot = orders + existing_split + collected_payments + session status (same as SSR).
 * Soft menu→bill must not keep a frozen half shell; do not gate reconcile on submitted.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { shouldShowCheckoutSubmitted } from '@/lib/checkout-split-continuation';
import {
  individualPhoneHoldsOrdering,
  individualReadOnlyTicketKeys,
  type IndividualTicketInfo,
} from '@/lib/individual-checkout';
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
    sessionId: string | null;
    sessionStatus: SessionStatus;
    /** Session stamped individual_checkout (SSR boot). */
    individualCheckout?: boolean;
    individualTickets?: IndividualTicketInfo[];
  },
  params: {
    slug: string;
    tableId: string;
    /** Asking phone — lets the server mark which called tickets are `mine`. */
    guestClientId?: string | null;
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
  const [sessionId, setSessionId] = useState<string | null>(initial.sessionId);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(initial.sessionStatus);
  const [individualCheckout, setIndividualCheckout] = useState(
    () => initial.individualCheckout === true,
  );
  const [individualTickets, setIndividualTickets] = useState<IndividualTicketInfo[]>(
    () => initial.individualTickets ?? [],
  );
  const [submitted, setSubmitted] = useState(() =>
    initial.individualCheckout === true
      ? individualPhoneHoldsOrdering(
          initial.individualTickets ?? [],
          initial.existingSplit?.result ?? [],
        )
      : shouldShowCheckoutSubmitted(initial.existingSplit, initial.sessionStatus),
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  // The in-flight read is keyed by the asking phone: a read started before the phone id was known
  // (no `mine`) must neither be reused for, nor overwrite, a read that carries the id.
  const syncInFlightRef = useRef<{
    clientId: string | null;
    promise: Promise<CustomerBillSyncSnapshot | null>;
  } | null>(null);
  const syncSeqRef = useRef(0);
  const guestClientIdRef = useRef<string | null>(params.guestClientId ?? null);
  guestClientIdRef.current = params.guestClientId ?? null;
  const callBillBusyRef = useRef(false);
  /** Individual sessions render only after one read that carried this phone's id. */
  const [individualReady, setIndividualReady] = useState(false);

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
    setSessionId(initial.sessionId);
    setSessionStatus(initial.sessionStatus);
    setIndividualCheckout(initial.individualCheckout === true);
    setIndividualTickets(initial.individualTickets ?? []);
    if (!callBillBusyRef.current) {
      setSubmitted(
        initial.individualCheckout === true
          ? individualPhoneHoldsOrdering(
              initial.individualTickets ?? [],
              initial.existingSplit?.result ?? [],
            )
          : shouldShowCheckoutSubmitted(initial.existingSplit, initial.sessionStatus),
      );
    }
  }, [
    initial.existingSplit,
    initial.collectedPayments,
    initial.sessionId,
    initial.sessionStatus,
    initial.individualCheckout,
    initial.individualTickets,
  ]);

  const individualReadOnlyKeys = useMemo(
    () => individualReadOnlyTicketKeys(individualTickets),
    [individualTickets],
  );

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
      setSessionId(synced.sessionId);
      if (synced.sessionStatus) setSessionStatus(synced.sessionStatus);
      setIndividualCheckout(synced.individualCheckout);
      setIndividualTickets(synced.individualTickets);
      if (!callBillBusyRef.current) {
        setSubmitted(
          synced.individualCheckout
            ? individualPhoneHoldsOrdering(
                synced.individualTickets,
                synced.existingSplit?.result ?? [],
              )
            : shouldShowCheckoutSubmitted(synced.existingSplit, synced.sessionStatus),
        );
      }
      markSynced();
    },
    [markSynced],
  );

  const refreshBill = useCallback(async (): Promise<CustomerBillSyncSnapshot | null> => {
    const clientId = guestClientIdRef.current;
    const inFlight = syncInFlightRef.current;
    if (inFlight && inFlight.clientId === clientId) {
      return inFlight.promise;
    }

    const seq = syncSeqRef.current + 1;
    syncSeqRef.current = seq;
    const handle: { promise?: Promise<CustomerBillSyncSnapshot | null> } = {};
    handle.promise = (async () => {
      setIsSyncing(true);
      try {
        const synced = await syncCustomerBill(params.slug, params.tableId, clientId);
        if (!synced) {
          // Do not hold the page blank forever when the id'd read fails; writes stay server-guarded.
          if (clientId && seq === syncSeqRef.current) setIndividualReady(true);
          return null;
        }
        // A newer read owns the state; an older response (e.g. before the phone id) is dropped.
        if (seq === syncSeqRef.current) {
          applySnapshot(synced);
          if (clientId) setIndividualReady(true);
        }
        return synced;
      } finally {
        setIsSyncing(false);
        if (syncInFlightRef.current?.promise === handle.promise) syncInFlightRef.current = null;
      }
    })();

    syncInFlightRef.current = { clientId, promise: handle.promise };
    return handle.promise;
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

  /**
   * Individual-checkout call success: reload the shared plan + ticket states, then show the
   * called (待结账) screen for this phone. Never commit a local split — the plan holds other tickets.
   */
  const commitIndividualCalled = useCallback(async () => {
    await refreshBill();
    setSubmitted(true);
  }, [refreshBill]);

  /** Call-bill success: split + submitted land together (never submitted over the pre-submit split). */
  const commitSubmittedCheckout = useCallback((submittedSplit: BillSplit) => {
    setExistingSplit(submittedSplit);
    setSubmitted(true);
  }, []);

  // Entry + visibility: full bill truth (orders + split + ledger). Never disable for submitted.
  useRestaurantStaffEntryReconcile(enabled, refreshBill, params.tableId);

  return {
    orders,
    partyMemberCount,
    existingSplit,
    collectedPayments,
    sessionId,
    sessionStatus,
    submitted,
    individualCheckout,
    individualTickets,
    individualReadOnlyKeys,
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
    commitSubmittedCheckout,
    commitIndividualCalled,
    individualReady,
  };
}
