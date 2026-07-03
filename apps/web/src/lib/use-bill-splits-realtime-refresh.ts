'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Realtime on bill_splits only — debounced reload when checkout queue may have changed.
 * Callers reconcile via staff API on mount; this hook handles live updates only.
 */
export function useBillSplitsRealtimeRefresh(
  supabase: SupabaseClient,
  restaurantId: string,
  channelKey: string,
  enabled: boolean,
  onRefresh: () => void,
  debounceMs = 1200,
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    let channel: RealtimeChannel | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        onRefreshRef.current();
      }, debounceMs);
    };

    const subscribe = () => {
      if (channel) return;
      channel = supabase
        .channel(channelKey)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bill_splits',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          scheduleRefresh,
        )
        .subscribe();
    };

    const unsubscribe = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') subscribe();
      else unsubscribe();
    };

    if (document.visibilityState === 'visible') subscribe();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [channelKey, debounceMs, enabled, restaurantId, supabase]);
}
