'use client';

import { useMemo } from 'react';
import { createGuestClient } from '@/lib/supabase/guest-client';
import {
  STAFF_BOARD_SIGNAL_DEBOUNCE_MS,
  useDebouncedPostgresRealtimeRefresh,
} from '@/lib/use-restaurant-realtime-refresh';

/**
 * Sole guest Realtime doorbell for menu catalog freshness: `menu_catalog_signals`
 * (mirrors `restaurants.menu_catalog_version` on dashboard invalidate). Debounced →
 * caller `onRefresh` must run {@link ensureCustomerMenuCatalog} / reconcile
 * (knownVersion; full GET only on mismatch). Dynamic-import so guest SSR stays free
 * of the transport chunk.
 */
export function CustomerMenuCatalogRealtime(props: {
  restaurantId: string | null;
  enabled: boolean;
  onRefresh: () => void;
}) {
  const supabase = useMemo(() => createGuestClient(), []);
  const restaurantFilter = props.restaurantId
    ? `restaurant_id=eq.${props.restaurantId}`
    : '';

  useDebouncedPostgresRealtimeRefresh(
    supabase,
    `customer-menu-catalog:${props.restaurantId ?? 'none'}`,
    props.enabled && Boolean(props.restaurantId),
    props.restaurantId
      ? [{ table: 'menu_catalog_signals', filter: restaurantFilter }]
      : [],
    props.onRefresh,
    STAFF_BOARD_SIGNAL_DEBOUNCE_MS,
  );

  return null;
}
