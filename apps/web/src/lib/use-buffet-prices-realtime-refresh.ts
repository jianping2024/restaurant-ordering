'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useDebouncedPostgresRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';

/**
 * Realtime refresh when buffet pricing config changes.
 * Initial / resume price load stays with the caller (or entry reconcile).
 */
export function useBuffetPricesRealtimeRefresh(
  supabase: SupabaseClient,
  restaurantId: string,
  enabled: boolean,
  onRefresh: () => void,
  debounceMs = 1200,
) {
  const filter = `restaurant_id=eq.${restaurantId}`;
  useDebouncedPostgresRealtimeRefresh(
    supabase,
    `buffet-prices-${restaurantId}`,
    enabled,
    [
      { table: 'buffets', filter },
      { table: 'buffet_time_slots', filter },
      { table: 'buffet_price_rules', filter },
      { table: 'buffet_calendar_overrides', filter },
    ],
    onRefresh,
    debounceMs,
  );
}
