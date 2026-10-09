'use client';

import { useMemo } from 'react';
import { createGuestClient } from '@/lib/supabase/guest-client';
import {
  STAFF_BOARD_SIGNAL_DEBOUNCE_MS,
  useDebouncedPostgresRealtimeRefresh,
} from '@/lib/use-restaurant-realtime-refresh';

/**
 * Sole guest Realtime doorbell for one QR table (menu + bill): 开台 (table_sessions) +
 * orders (incl. staff headcount). Dynamic-import so guest SSR stays free of the transport chunk.
 * Doorbell → debounced GET via caller onRefresh (menu: session; bill: syncCustomerBill).
 */
export function CustomerTableSessionRealtime(props: {
  tableId: string | null;
  enabled: boolean;
  onRefresh: () => void;
}) {
  const supabase = useMemo(() => createGuestClient(), []);
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
