'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Staff board/detail freshness contract (production):
 * 1. SSR page seed — first paint when server auth + load succeed
 * 2. Published staff model cache — detail commits after Staff API; board clears per-table when API confirms
 * 3. Client entry reconcile — Staff API on mount (dashboard board provider always reconciles)
 * 4. Staff menu submit return — dedicated reconcile, then strip query
 * 5. Realtime while mounted (`useRestaurantRealtimeRefresh`)
 * 6. Dashboard staff mutations — `WaiterBoardProvider.refreshBoardAfterStaffMutation` (open, checkout, transfer/merge)
 */
export function useRestaurantStaffEntryReconcile(
  enabled: boolean,
  refresh: () => void | Promise<unknown>,
  entryKey?: string | number,
) {
  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh, entryKey]);
}

/**
 * Supabase Realtime (WebSocket): debounced refresh when orders / sessions / bills change.
 * Entry reload is the caller's job — use `useRestaurantStaffEntryReconcile` on mount/navigation.
 * Unsubscribes while hidden.
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
