'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Realtime (WebSocket): refresh when orders / sessions / bills change.
 * Also refreshes once when the channel subscribes (mount or tab visible again).
 * Unsubscribes while the tab is hidden or on unmount — no background polling.
 */
export function useRestaurantRealtimeRefresh(
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
      // Always reconcile client state on subscribe (mount / tab visible). SSR seed is for first paint only.
      onRefreshRef.current();
      channel = supabase
        .channel(channelKey)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'orders',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'table_sessions',
            filter: `restaurant_id=eq.${restaurantId}`,
          },
          scheduleRefresh,
        )
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
