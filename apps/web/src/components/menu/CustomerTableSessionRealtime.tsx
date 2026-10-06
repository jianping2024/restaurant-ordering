'use client';

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  STAFF_BOARD_SIGNAL_DEBOUNCE_MS,
  useDebouncedPostgresRealtimeRefresh,
} from '@/lib/use-restaurant-realtime-refresh';

/**
 * Sole guest-menu Realtime doorbell for one QR table: 开台 (table_sessions) + submitted
 * orders. Dynamic-import so MenuPage SSR stays free of the transport chunk.
 * Doorbell → debounced GET via caller onRefresh (sole authority: customer/session).
 */
export function CustomerTableSessionRealtime(props: {
  tableId: string | null;
  enabled: boolean;
  onRefresh: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const tableFilter = props.tableId ? `table_id=eq.${props.tableId}` : '';

  useDebouncedPostgresRealtimeRefresh(
    supabase,
    `customer-table-session:${props.tableId ?? 'none'}`,
    props.enabled && Boolean(props.tableId),
    props.tableId
      ? [
          { table: 'table_sessions', filter: tableFilter },
          { table: 'orders', filter: tableFilter },
        ]
      : [],
    props.onRefresh,
    STAFF_BOARD_SIGNAL_DEBOUNCE_MS,
  );

  return null;
}
