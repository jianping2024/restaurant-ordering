'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useDebouncedPostgresRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';

/**
 * Supabase Realtime on bill_splits only — debounced reload when checkout queue may have changed.
 * Mount / visibility resume reconcile belongs with `useRestaurantStaffEntryReconcile`.
 */
export function useBillSplitsRealtimeRefresh(
  supabase: SupabaseClient,
  restaurantId: string,
  channelKey: string,
  enabled: boolean,
  onRefresh: () => void,
  debounceMs = 1200,
) {
  useDebouncedPostgresRealtimeRefresh(
    supabase,
    channelKey,
    enabled,
    [{ table: 'bill_splits', filter: `restaurant_id=eq.${restaurantId}` }],
    onRefresh,
    debounceMs,
  );
}
