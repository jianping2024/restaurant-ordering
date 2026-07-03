'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT } from '@/lib/checkout-request-count-sync';
import { requestCheckoutRequestsCount } from '@/lib/request-checkout-requests-queue';
import { useBillSplitsRealtimeRefresh } from '@/lib/use-bill-splits-realtime-refresh';

/**
 * Pending checkout request count for dashboard nav badge.
 * Realtime triggers reconcile via staff API (same auth path as checkout queue page).
 */
export function useCheckoutRequestCount(
  restaurantId: string,
  restaurantSlug: string,
  enabled: boolean,
): number {
  const [count, setCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const reloadSeqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++reloadSeqRef.current;
    try {
      const next = await requestCheckoutRequestsCount(restaurantSlug);
      if (seq !== reloadSeqRef.current) return;
      setCount(next);
    } catch {
      if (seq !== reloadSeqRef.current) return;
    }
  }, [restaurantSlug]);

  useBillSplitsRealtimeRefresh(
    supabase,
    restaurantId,
    `checkout-request-count-${restaurantId}`,
    enabled,
    reload,
  );

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    const onInvalidate = () => void reload();
    window.addEventListener(CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT, onInvalidate);

    return () => {
      reloadSeqRef.current += 1;
      window.removeEventListener(CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT, onInvalidate);
    };
  }, [enabled, reload]);

  return count;
}
