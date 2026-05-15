'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Realtime refresh when buffet pricing config changes (owner dashboard).
 * Same visibility rules as useRestaurantRealtimeRefresh — no work while tab hidden.
 */
export function useBuffetPricesRealtimeRefresh(
  supabase: SupabaseClient,
  restaurantId: string,
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

    const filter = `restaurant_id=eq.${restaurantId}`;

    const subscribe = () => {
      if (channel) return;
      onRefreshRef.current();
      channel = supabase
        .channel(`buffet-prices-${restaurantId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'buffets', filter },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'buffet_time_slots', filter },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'buffet_price_rules', filter },
          scheduleRefresh,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'buffet_calendar_overrides', filter },
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
  }, [debounceMs, enabled, restaurantId, supabase]);
}
