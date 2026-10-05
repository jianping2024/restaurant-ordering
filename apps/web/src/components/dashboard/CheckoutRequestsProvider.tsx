'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CheckoutRequestsContext,
} from '@/components/dashboard/checkout-requests-context';
import { CheckoutPrintAskController } from '@/components/dashboard/checkout/CheckoutPrintAskController';
import type { CheckoutPrintAsk } from '@/components/dashboard/checkout/CheckoutPrintChoiceDialog';
import { createClient } from '@/lib/supabase/client';
import {
  applyConfirmPaymentToRequests,
  appendCollectedPaymentToSessionMap,
  mergeCollectedLedgersBySession,
  type ConfirmPaymentClientOutcome,
} from '@/lib/checkout-confirm-payment-outcome';
import { mergeBillSplitsFromRefresh } from '@/lib/checkout-request-state';
import { upsertCheckoutRequestInQueue } from '@/lib/checkout-request-submit';
import {
  parseSessionCollectedPaymentsWithSession,
  SESSION_COLLECTED_PAYMENT_SELECT,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import { groupCollectedPaymentsBySession } from '@/lib/checkout-settlement';
import { requestCheckoutRequestsQueue } from '@/lib/request-checkout-requests-queue';
import {
  readPendingCheckoutPrintAsk,
  writePendingCheckoutPrintAsk,
} from '@/lib/checkout-print-ask-store';
import dynamic from 'next/dynamic';
import { useRestaurantStaffEntryReconcile } from '@/lib/use-restaurant-staff-entry-reconcile';
import type { BillSplit } from '@/types';

const CheckoutRequestsRealtime = dynamic(
  () =>
    import('@/components/dashboard/CheckoutRequestsRealtime').then(
      (m) => m.CheckoutRequestsRealtime,
    ),
  { ssr: false },
);

export {
  useCheckoutRequests,
  useCheckoutRequestsPendingCount,
} from '@/components/dashboard/checkout-requests-context';
export type { CheckoutRequestsContextValue } from '@/components/dashboard/checkout-requests-context';

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
  const [printAsk, setPrintAskState] = useState<CheckoutPrintAsk | null>(
    () => readPendingCheckoutPrintAsk(),
  );
  const printAskRef = useRef<CheckoutPrintAsk | null>(readPendingCheckoutPrintAsk());
  const setPrintAsk = useCallback((ask: CheckoutPrintAsk | null) => {
    writePendingCheckoutPrintAsk(ask);
    printAskRef.current = ask;
    setPrintAskState(ask);
  }, []);
  printAskRef.current = printAsk;
  const reloadSeqRef = useRef(0);
  const supabase = useMemo(() => createClient(), []);

  const reload = useCallback(async () => {
    if (!enabled) return;
    const seq = ++reloadSeqRef.current;
    try {
      const incoming = await requestCheckoutRequestsQueue(restaurantSlug);
      if (seq !== reloadSeqRef.current) return;
      setRequests((prev) => {
        const merged = mergeBillSplitsFromRefresh(prev, incoming);
        const ask = printAskRef.current;
        // Keep the paid row on screen until staff answers the print question.
        if (!ask) return merged;
        if (merged.some((row) => row.id === ask.billSplitId)) return merged;
        const held = prev.find((row) => row.id === ask.billSplitId);
        return held ? [...merged, held] : merged;
      });
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
      printAsk?: CheckoutPrintAsk | null;
      heldRow?: BillSplit;
    }) => {
      const { billSplitId, sessionId, outcome } = params;
      if (params.printAsk) {
        printAskRef.current = params.printAsk;
        setPrintAsk(params.printAsk);
      }
      // Keep the queue row until staff answers the print question after the last payment.
      const queueOutcome =
        params.printAsk?.allPaid
          ? { ...outcome, all_paid: false }
          : outcome;
      setRequests((prev) => {
        let next = applyConfirmPaymentToRequests(prev, billSplitId, queueOutcome);
        if (
          params.printAsk?.allPaid &&
          params.heldRow &&
          !next.some((row) => row.id === billSplitId)
        ) {
          next = [
            ...next,
            {
              ...params.heldRow,
              result: outcome.result,
            },
          ];
        }
        return next;
      });
      if (sessionId && outcome.collection) {
        setCollectedPaymentsBySession((prev) =>
          appendCollectedPaymentToSessionMap(prev, sessionId, outcome.collection!),
        );
      }
    },
    [setPrintAsk],
  );

  const finishPrintAsk = useCallback(
    (ask: CheckoutPrintAsk) => {
      setPrintAsk(null);
      if (!ask.allPaid) return;
      setRequests((prev) => prev.filter((row) => row.id !== ask.billSplitId));
    },
    [setPrintAsk],
  );

  useRestaurantStaffEntryReconcile(enabled, reload);


  const value = useMemo(
    () => ({
      requests,
      pendingCount: requests.length,
      reload,
      updateRequests,
      upsertRequestFromSubmit,
      getCollectedForSession,
      applyConfirmPaymentOutcome,
      printAsk,
      setPrintAsk,
    }),
    [
      requests,
      reload,
      updateRequests,
      upsertRequestFromSubmit,
      getCollectedForSession,
      applyConfirmPaymentOutcome,
      printAsk,
      setPrintAsk,
    ],
  );

  return (
    <CheckoutRequestsContext.Provider value={value}>
      <CheckoutRequestsRealtime
        supabase={supabase}
        restaurantId={restaurantId}
        enabled={enabled}
        onRefresh={() => {
          void reload();
        }}
      />
      {children}
      {enabled ? (
        <CheckoutPrintAskController
          ask={printAsk}
          restaurantSlug={restaurantSlug}
          onDone={finishPrintAsk}
        />
      ) : null}
    </CheckoutRequestsContext.Provider>
  );
}
