'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT } from '@/lib/checkout-request-count-sync';
import { countPendingCheckoutRequests } from '@/lib/table-checkout-pending';

/**
 * Pending checkout request count for dashboard nav badge.
 * Reconciles on mount, tab visible, bill_splits Realtime, and explicit invalidation.
 */
export function useCheckoutRequestCount(restaurantId: string, enabled: boolean): number {
  const [count, setCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const reloadSeqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++reloadSeqRef.current;
    const next = await countPendingCheckoutRequests(supabase, restaurantId);
    if (seq !== reloadSeqRef.current) return;
    setCount(next);
  }, [restaurantId, supabase]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }

    let channel: RealtimeChannel | null = null;

    const subscribe = () => {
      if (channel) return;
      void reload();
      channel = supabase
        .channel(`checkout-request-count-${restaurantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bill_splits',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => void reload(),
        )
        .subscribe();
    };

    const unsubscribe = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') subscribe();
      else unsubscribe();
    };

    const onInvalidate = () => void reload();

    if (document.visibilityState === 'visible') subscribe();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT, onInvalidate);

    return () => {
      reloadSeqRef.current += 1;
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT, onInvalidate);
    };
  }, [enabled, reload, restaurantId, supabase]);

  return count;
}
