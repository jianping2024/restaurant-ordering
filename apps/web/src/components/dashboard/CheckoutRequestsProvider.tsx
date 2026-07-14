'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  applyConfirmPaymentToRequests,
  appendCollectedPaymentToSessionMap,
  mergeCollectedLedgersBySession,
  type ConfirmPaymentClientOutcome,
} from '@/lib/checkout-confirm-payment-outcome';
import { mergeBillSplitsFromRefresh } from '@/lib/checkout-request-state';
import { upsertCheckoutRequestInQueue } from '@/lib/checkout-request-submit';
import { consumeStagedCheckoutRequest } from '@/lib/checkout-request-staging';
import {
  parseSessionCollectedPaymentsWithSession,
  SESSION_COLLECTED_PAYMENT_SELECT,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import { groupCollectedPaymentsBySession } from '@/lib/checkout-settlement';
import { requestCheckoutRequestsQueue } from '@/lib/request-checkout-requests-queue';
import { useBillSplitsRealtimeRefresh } from '@/lib/use-bill-splits-realtime-refresh';
import type { BillSplit } from '@/types';

type CheckoutRequestsContextValue = {
  requests: BillSplit[];
  pendingCount: number;
  reload: () => Promise<void>;
  updateRequests: (updater: (prev: BillSplit[]) => BillSplit[]) => void;
  upsertRequestFromSubmit: (row: BillSplit) => void;
  getCollectedForSession: (sessionId: string | null | undefined) => SessionCollectedPayment[];
  applyConfirmPaymentOutcome: (params: {
    billSplitId: string;
    sessionId: string | null | undefined;
    outcome: ConfirmPaymentClientOutcome;
  }) => void;
};

const CheckoutRequestsContext = createContext<CheckoutRequestsContextValue | null>(null);

export function useCheckoutRequests(): CheckoutRequestsContextValue {
  const ctx = useContext(CheckoutRequestsContext);
  if (!ctx) {
    throw new Error('useCheckoutRequests must be used within CheckoutRequestsProvider');
  }
  return ctx;
}

type Props = {
  restaurantId: string;
  restaurantSlug: string;
  /** Owner dashboard has no checkout queue nav badge or Realtime sync. */
  enabled: boolean;
  initialRequests?: BillSplit[];
  children: ReactNode;
};

export function CheckoutRequestsProvider({
  restaurantId,
  restaurantSlug,
  enabled,
  initialRequests = [],
  children,
}: Props) {
  const [requests, setRequests] = useState<BillSplit[]>(() =>
    enabled ? initialRequests : [],
  );
  const [collectedPaymentsBySession, setCollectedPaymentsBySession] = useState<
    Map<string, SessionCollectedPayment[]>
  >(() => new Map());
  const reloadSeqRef = useRef(0);
  const supabase = useMemo(() => createClient(), []);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const seq = ++reloadSeqRef.current;
    try {
      const incoming = await requestCheckoutRequestsQueue(restaurantSlug);
      if (seq !== reloadSeqRef.current) return;
      setRequests((prev) => mergeBillSplitsFromRefresh(prev, incoming));
    } catch {
      if (seq !== reloadSeqRef.current) return;
    }
  }, [enabled, restaurantSlug]);

  const updateRequests = useCallback((updater: (prev: BillSplit[]) => BillSplit[]) => {
    setRequests(updater);
  }, []);

  const upsertRequestFromSubmit = useCallback((row: BillSplit) => {
    setRequests((prev) => upsertCheckoutRequestInQueue(prev, row));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const staged = consumeStagedCheckoutRequest();
    if (!staged) return;
    upsertRequestFromSubmit(staged);
  }, [enabled, upsertRequestFromSubmit]);

  useEffect(() => {
    if (!enabled) {
      setCollectedPaymentsBySession(new Map());
      return;
    }

    const sessionIds = Array.from(
      new Set(
        requests
          .map((request) => request.session_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    if (!restaurantId || sessionIds.length === 0) {
      setCollectedPaymentsBySession(new Map());
      return;
    }

    let cancelled = false;
    const loadCollectedLedgers = async () => {
      const { data, error } = await supabase
        .from('session_collected_payments')
        .select(SESSION_COLLECTED_PAYMENT_SELECT)
        .eq('restaurant_id', restaurantId)
        .in('session_id', sessionIds)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        setCollectedPaymentsBySession(new Map());
        return;
      }

      setCollectedPaymentsBySession((prev) =>
        mergeCollectedLedgersBySession(
          groupCollectedPaymentsBySession(parseSessionCollectedPaymentsWithSession(data)),
          prev,
        ),
      );
    };

    void loadCollectedLedgers();
    return () => {
      cancelled = true;
    };
  }, [enabled, restaurantId, requests, supabase]);

  const getCollectedForSession = useCallback(
    (sessionId: string | null | undefined) => {
      if (!sessionId) return [];
      return collectedPaymentsBySession.get(sessionId) ?? [];
    },
    [collectedPaymentsBySession],
  );

  const applyConfirmPaymentOutcome = useCallback(
    (params: {
      billSplitId: string;
      sessionId: string | null | undefined;
      outcome: ConfirmPaymentClientOutcome;
    }) => {
      const { billSplitId, sessionId, outcome } = params;
      setRequests((prev) => applyConfirmPaymentToRequests(prev, billSplitId, outcome));
      if (sessionId && outcome.collection) {
        setCollectedPaymentsBySession((prev) =>
          appendCollectedPaymentToSessionMap(prev, sessionId, outcome.collection!),
        );
      }
    },
    [],
  );

  useBillSplitsRealtimeRefresh(
    supabase,
    restaurantId,
    `checkout-queue-${restaurantId}`,
    enabled,
    () => {
      void reload();
    },
  );

  const value = useMemo(
    () => ({
      requests,
      pendingCount: requests.length,
      reload,
      updateRequests,
      upsertRequestFromSubmit,
      getCollectedForSession,
      applyConfirmPaymentOutcome,
    }),
    [requests, reload, updateRequests, upsertRequestFromSubmit, getCollectedForSession, applyConfirmPaymentOutcome],
  );

  return (
    <CheckoutRequestsContext.Provider value={value}>{children}</CheckoutRequestsContext.Provider>
  );
}
