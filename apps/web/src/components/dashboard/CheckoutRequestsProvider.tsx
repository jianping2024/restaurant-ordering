'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { mergeBillSplitsFromRefresh } from '@/lib/checkout-request-state';
import { requestCheckoutRequestsQueue } from '@/lib/request-checkout-requests-queue';
import { useBillSplitsRealtimeRefresh } from '@/lib/use-bill-splits-realtime-refresh';
import type { BillSplit } from '@/types';

type CheckoutRequestsContextValue = {
  requests: BillSplit[];
  pendingCount: number;
  reload: () => Promise<void>;
  hydrateFromServer: (serverRequests: BillSplit[]) => void;
  updateRequests: (updater: (prev: BillSplit[]) => BillSplit[]) => void;
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
  children: ReactNode;
};

export function CheckoutRequestsProvider({
  restaurantId,
  restaurantSlug,
  enabled,
  children,
}: Props) {
  const [requests, setRequests] = useState<BillSplit[]>([]);
  const reloadSeqRef = useRef(0);
  const skipSubscribeReloadRef = useRef(false);
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

  const hydrateFromServer = useCallback((serverRequests: BillSplit[]) => {
    skipSubscribeReloadRef.current = true;
    setRequests(serverRequests);
  }, []);

  const updateRequests = useCallback((updater: (prev: BillSplit[]) => BillSplit[]) => {
    setRequests(updater);
  }, []);

  const reconcileOnSubscribe = useCallback(() => {
    if (skipSubscribeReloadRef.current) {
      skipSubscribeReloadRef.current = false;
      return;
    }
    void reload();
  }, [reload]);

  useBillSplitsRealtimeRefresh(
    supabase,
    restaurantId,
    `checkout-queue-${restaurantId}`,
    enabled,
    reconcileOnSubscribe,
  );

  const value = useMemo(
    () => ({
      requests,
      pendingCount: requests.length,
      reload,
      hydrateFromServer,
      updateRequests,
    }),
    [requests, reload, hydrateFromServer, updateRequests],
  );

  return (
    <CheckoutRequestsContext.Provider value={value}>{children}</CheckoutRequestsContext.Provider>
  );
}
