'use client';

/**
 * Sole customer BillPage read-model: entry / visibility reconcile via {@link syncCustomerBill}.
 * One snapshot = orders + existing_split + collected_payments + session status (same as SSR).
 * Soft menu→bill must not keep a frozen half shell; do not gate reconcile on submitted.
 *
 * UI phase sole {@link resolveGuestBillSurfacePhase} — not {@link individualPhoneHoldsOrdering}.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { guestTablePlanHoldsCheckout } from '@/lib/guest-bill-split-mode';
import {
  resolveGuestBillSurfacePhase,
  type GuestBillSurfacePhase,
} from '@/lib/guest-bill-surface-phase';
import { individualPhoneHoldsOrdering, type IndividualTicketInfo } from '@/lib/individual-checkout';
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

function phaseInputsFromSnapshot(
  snapshot: Pick<
    CustomerBillSyncSnapshot,
    'individualTickets' | 'existingSplit' | 'sessionId'
  >,
  localCalledLatch: boolean,
  previousPhase: GuestBillSurfacePhase,
) {
  const phoneHoldsOrdering = individualPhoneHoldsOrdering(
    snapshot.individualTickets,
    snapshot.existingSplit?.result ?? [],
  );
  const tablePlanHoldsCheckout = guestTablePlanHoldsCheckout(snapshot.existingSplit);
  return {
    phoneHoldsOrdering,
    tablePlanHoldsCheckout,
    localCalledLatch,
    sessionId: snapshot.sessionId,
    splitStatus: snapshot.existingSplit?.status ?? null,
    previousPhase,
  };
}

export function useCustomerBillReadModel(
  initial: {
    orders: Order[];
    partyMemberCount?: number;
    existingSplit: BillSplit | null;
    collectedPayments: SessionCollectedPayment[];
    sessionId: string | null;
    sessionStatus: SessionStatus;
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
  const [individualTickets, setIndividualTickets] = useState<IndividualTicketInfo[]>(
    () => initial.individualTickets ?? [],
  );
  const [surfacePhase, setSurfacePhase] = useState<GuestBillSurfacePhase>(() =>
    resolveGuestBillSurfacePhase(
      phaseInputsFromSnapshot(
        {
          individualTickets: initial.individualTickets ?? [],
          existingSplit: initial.existingSplit,
          sessionId: initial.sessionId,
        },
        false,
        'editing',
      ),
    ),
  );
  /** By-item ordering hold only — menu append / claim gates. Not the bill success shell. */
  const [orderingHeld, setOrderingHeld] = useState(() =>
    individualPhoneHoldsOrdering(
      initial.individualTickets ?? [],
      initial.existingSplit?.result ?? [],
    ),
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
  const localCalledLatchRef = useRef(false);
  const surfacePhaseRef = useRef(surfacePhase);
  surfacePhaseRef.current = surfacePhase;
  /** The guest editor renders only after one read that carried this phone's id (`mine` tickets). */
  const [ticketsReady, setTicketsReady] = useState(false);

  const markSynced = useCallback(() => {
    setLastSyncedAt(Date.now());
  }, []);

  const applyPhaseFromSnapshot = useCallback((synced: CustomerBillSyncSnapshot) => {
    const phoneHoldsOrdering = individualPhoneHoldsOrdering(
      synced.individualTickets,
      synced.existingSplit?.result ?? [],
    );
    setOrderingHeld(phoneHoldsOrdering);
    const nextPhase = resolveGuestBillSurfacePhase(
      phaseInputsFromSnapshot(synced, localCalledLatchRef.current, surfacePhaseRef.current),
    );
    if (phoneHoldsOrdering || guestTablePlanHoldsCheckout(synced.existingSplit)) {
      localCalledLatchRef.current = false;
    }
    surfacePhaseRef.current = nextPhase;
    setSurfacePhase(nextPhase);
    return nextPhase;
  }, []);

  useEffect(() => {
    setOrders(initial.orders);
  }, [initial.orders]);

  useEffect(() => {
    if (initial.partyMemberCount == null) return;
    setPartyMemberCount(initial.partyMemberCount);
  }, [initial.partyMemberCount]);

  useEffect(() => {
    if (callBillBusyRef.current) return;
    // Settled keeps the frozen meal snapshot; SSR props must not reopen a closed session.
    if (surfacePhaseRef.current === 'settled') return;
    const boot: CustomerBillSyncSnapshot = {
      individualTickets: initial.individualTickets ?? [],
      orders: initial.orders,
      partyMemberCount: initial.partyMemberCount ?? 0,
      existingSplit: initial.existingSplit,
      collectedPayments: initial.collectedPayments,
      sessionId: initial.sessionId,
      sessionStatus: initial.sessionStatus,
      ...deriveBillView(initial.orders),
    };
    setExistingSplit(boot.existingSplit);
    setCollectedPayments(boot.collectedPayments);
    setSessionId(boot.sessionId);
    setSessionStatus(boot.sessionStatus ?? initial.sessionStatus);
    setIndividualTickets(boot.individualTickets);
    applyPhaseFromSnapshot(boot);
    // Omit initial.orders / partyMemberCount: owned by dedicated effects; settled must not rehydrate SSR.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [
    applyPhaseFromSnapshot,
    initial.existingSplit,
    initial.collectedPayments,
    initial.sessionId,
    initial.sessionStatus,
    initial.individualTickets,
  ]);

  const { orderLines, splitOrderLines, lineSpecs, total } = useMemo(
    () => deriveBillView(orders),
    [orders],
  );

  const applySnapshot = useCallback(
    (synced: CustomerBillSyncSnapshot) => {
      const nextPhase = resolveGuestBillSurfacePhase(
        phaseInputsFromSnapshot(synced, localCalledLatchRef.current, surfacePhaseRef.current),
      );
      // Closed-table sync returns empty orders; keep the last meal on the settled screen
      // whether the phone was already submitted or still on the call-checkout editor.
      const freezeSettledDisplay =
        nextPhase === 'settled' && !synced.sessionId && synced.orders.length === 0;

      if (freezeSettledDisplay) {
        setSessionId(null);
        applyPhaseFromSnapshot(synced);
        markSynced();
        return;
      }

      setOrders(synced.orders);
      setPartyMemberCount(synced.partyMemberCount);
      setExistingSplit(synced.existingSplit);
      setCollectedPayments(synced.collectedPayments);
      setSessionId(synced.sessionId);
      if (synced.sessionStatus) setSessionStatus(synced.sessionStatus);
      setIndividualTickets(synced.individualTickets);
      applyPhaseFromSnapshot(synced);
      markSynced();
    },
    [applyPhaseFromSnapshot, markSynced],
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
          if (clientId && seq === syncSeqRef.current) setTicketsReady(true);
          return null;
        }
        // A newer read owns the state; an older response (e.g. before the phone id) is dropped.
        if (seq === syncSeqRef.current) {
          applySnapshot(synced);
          if (clientId) setTicketsReady(true);
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

  const latchAwaitingThenRefresh = useCallback(async () => {
    localCalledLatchRef.current = true;
    surfacePhaseRef.current = 'awaiting_payment';
    setSurfacePhase('awaiting_payment');
    await refreshBill();
  }, [refreshBill]);

  /**
   * Call success: reload the shared plan + ticket states, then show the called (待结账) screen
   * for this phone. Never commit a local split — the plan holds other tickets.
   */
  const commitIndividualCalled = useCallback(async () => {
    await latchAwaitingThenRefresh();
    setOrderingHeld(true);
  }, [latchAwaitingThenRefresh]);

  /** Whole-table / even call: latch awaiting until the shared plan sync confirms. */
  const commitTablePlanCalled = useCallback(async () => {
    await latchAwaitingThenRefresh();
  }, [latchAwaitingThenRefresh]);

  // Entry + visibility: full bill truth (orders + split + ledger). Never disable for submitted.
  useRestaurantStaffEntryReconcile(enabled, refreshBill, params.tableId);

  return {
    orders,
    partyMemberCount,
    existingSplit,
    collectedPayments,
    sessionId,
    sessionStatus,
    /** By-item unpaid call hold — menu/claim gates only; not the success shell. */
    orderingHeld,
    surfacePhase,
    individualTickets,
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
    commitIndividualCalled,
    commitTablePlanCalled,
    ticketsReady,
  };
}
