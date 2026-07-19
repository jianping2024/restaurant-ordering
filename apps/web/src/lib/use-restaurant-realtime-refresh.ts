'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Staff surface freshness contract (production):
 * 1. Boot seed — optional SSR/demo seed; Dashboard chrome does not SSR the waiter board
 * 2. Published staff model cache — detail commits after Staff API; board clears per-table when API confirms
 * 3. Client entry reconcile — when board list is active (`useRestaurantStaffEntryReconcile`);
 *    skip mount when boot seed is authoritative (`reconcileOnMount=false`), still resume on visibility
 * 4. Visibility / list-active reconcile — `resolveWaiterBoardReconcileScope(floorHydrated)`:
 *    cold (no floor static) → full; hydrated floor → live occupancy catch-up
 * 5. Staff menu submit return — dedicated reconcile, then strip query
 * 6. Realtime while the surface is active (`useRestaurantRealtimeRefresh`) — doorbell → live GET
 *    (occupancy slice); merge into one WaiterBoardData — see `waiter-board-live.ts`
 * 7. Dashboard staff mutations — `WaiterBoardProvider.refreshBoardAfterStaffMutation` (full)
 * 8. Detail → list re-shown — same as (4): live when floor hydrated, else full (no second path)
 *
 * Waiter board Realtime/entry pulls run only while the board list is visible (active);
 * other Dashboard routes keep the store dormant (mutations may still refresh).
 * Realtime never owns resume freshness: mobile tabs unsubscribe while hidden and would otherwise
 * miss cross-device closes until the next chance event.
 * No interval API polling — see `.cursor/rules/no-polling-except-fallback.mdc`.
 */

/** Debounce for Realtime → staff board signal refresh (not used for reconcile). */
export const STAFF_BOARD_SIGNAL_DEBOUNCE_MS = 2000;

/**
 * Reconcile authoritative staff read-models when a surface becomes active:
 * mount / entry navigation (optional), and document visible after being hidden.
 */
export function useRestaurantStaffEntryReconcile(
  enabled: boolean,
  refresh: () => void | Promise<unknown>,
  entryKey?: string | number,
  /** When false, skip mount pull (SSR already authoritative) but still resume. Default true. */
  reconcileOnMount = true,
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled || !reconcileOnMount) return;
    void refresh();
  }, [enabled, refresh, entryKey, reconcileOnMount]);

  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshRef.current();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, entryKey]);
}

export type PostgresRealtimeBinding = {
  table: string;
  filter: string;
};

/**
 * Shared transport: subscribe while the tab is visible; debounce postgres_changes → onRefresh.
 * Lifecycle reconcile (mount / resume) stays in `useRestaurantStaffEntryReconcile`.
 */
export function useDebouncedPostgresRealtimeRefresh(
  supabase: SupabaseClient,
  channelKey: string,
  enabled: boolean,
  bindings: readonly PostgresRealtimeBinding[],
  onRefresh: () => void,
  debounceMs = 1200,
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

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
      let next = supabase.channel(channelKey);
      for (const binding of bindingsRef.current) {
        next = next.on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: binding.table,
            filter: binding.filter,
          },
          scheduleRefresh,
        );
      }
      channel = next.subscribe();
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
    // bindings are read via ref; restaurant-scoped filters are in channelKey / enabled deps of callers
  }, [channelKey, debounceMs, enabled, supabase]);
}

/**
 * Supabase Realtime for staff boards: orders / sessions / bill_splits → debounced refresh.
 * Entry and resume reload: `useRestaurantStaffEntryReconcile`.
 */
export function useRestaurantRealtimeRefresh(
  supabase: SupabaseClient,
  restaurantId: string,
  channelKey: string,
  enabled: boolean,
  onRefresh: () => void,
  debounceMs = STAFF_BOARD_SIGNAL_DEBOUNCE_MS,
) {
  const filter = `restaurant_id=eq.${restaurantId}`;
  useDebouncedPostgresRealtimeRefresh(
    supabase,
    channelKey,
    enabled,
    [
      { table: 'orders', filter },
      { table: 'table_sessions', filter },
      { table: 'bill_splits', filter },
    ],
    onRefresh,
    debounceMs,
  );
}
