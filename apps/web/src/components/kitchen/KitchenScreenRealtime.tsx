'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useRestaurantRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';

/** Isolated realtime subscription for kitchen screens (dynamic import from board). */
export function KitchenScreenRealtime(props: {
  supabase: SupabaseClient;
  restaurantId: string;
  screenId: string;
  onRefresh: () => void;
}) {
  useRestaurantRealtimeRefresh(
    props.supabase,
    props.restaurantId,
    `kitchen-screen-${props.screenId}`,
    true,
    props.onRefresh,
  );
  return null;
}
