'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { useBillSplitsRealtimeRefresh } from '@/lib/use-bill-splits-realtime-refresh';

/** Isolated so CheckoutRequestsProvider does not statically import realtime transport. */
export function CheckoutRequestsRealtime(props: {
  supabase: SupabaseClient;
  restaurantId: string;
  enabled: boolean;
  onRefresh: () => void;
}) {
  useBillSplitsRealtimeRefresh(
    props.supabase,
    props.restaurantId,
    `checkout-queue-${props.restaurantId}`,
    props.enabled,
    props.onRefresh,
  );
  return null;
}
