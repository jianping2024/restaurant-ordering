'use client';

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  STAFF_BOARD_SIGNAL_DEBOUNCE_MS,
  useDebouncedPostgresRealtimeRefresh,
} from '@/lib/use-restaurant-realtime-refresh';

/**
 * Isolated Realtime doorbell for guest submitted orders on the active table session.
 * Dynamic-import from menu surfaces so MenuPage SSR graph stays free of the transport chunk.
 * Doorbell → debounced GET via caller onRefresh (sole authority: customer/session full).
 */
export function CustomerSessionOrdersRealtime(props: {
  sessionId: string | null;
  enabled: boolean;
  onRefresh: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const filter = props.sessionId ? `session_id=eq.${props.sessionId}` : '';

  useDebouncedPostgresRealtimeRefresh(
    supabase,
    `customer-session-orders:${props.sessionId ?? 'none'}`,
    props.enabled && Boolean(props.sessionId),
    props.sessionId ? [{ table: 'orders', filter }] : [],
    props.onRefresh,
    STAFF_BOARD_SIGNAL_DEBOUNCE_MS,
  );

  return null;
}
