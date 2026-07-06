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
    }),
    [requests, reload, updateRequests],
  );

  return (
    <CheckoutRequestsContext.Provider value={value}>{children}</CheckoutRequestsContext.Provider>
  );
}
