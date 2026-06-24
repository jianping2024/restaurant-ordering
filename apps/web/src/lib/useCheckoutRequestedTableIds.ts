'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { fetchCheckoutRequestedTableIds } from '@/lib/table-checkout-pending';

const CHECKOUT_TABLES_POLL_MS = 30_000;

export function useCheckoutRequestedTableIds(
  restaurantId: string | undefined,
  enabled: boolean,
  initialTableIds: string[] = [],
): string[] {
  const supabase = useMemo(() => createClient(), []);
  const [tableIds, setTableIds] = useState(initialTableIds);
  const refreshSeqRef = useRef(0);

  useEffect(() => {
    setTableIds(initialTableIds);
  }, [initialTableIds]);

  const refresh = useCallback(async () => {
    if (!restaurantId) return;
    const seq = ++refreshSeqRef.current;
    const ids = await fetchCheckoutRequestedTableIds(supabase, restaurantId);
    if (seq !== refreshSeqRef.current) return;
    setTableIds(ids);
  }, [restaurantId, supabase]);

  useEffect(() => {
    if (!enabled || !restaurantId) return;

    let channel: RealtimeChannel | null = null;
    let pollTimer: number | null = null;

    const subscribe = () => {
      if (channel) return;
      void refresh();
      channel = supabase
        .channel(`checkout-table-ids-${restaurantId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bill_splits',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          () => void refresh(),
        )
        .subscribe();
      pollTimer = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          void refresh();
        }
      }, CHECKOUT_TABLES_POLL_MS);
    };

    const unsubscribe = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        subscribe();
        void refresh();
      } else {
        unsubscribe();
      }
    };

    if (document.visibilityState === 'visible') {
      subscribe();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }, [enabled, refresh, restaurantId, supabase]);

  return tableIds;
}
