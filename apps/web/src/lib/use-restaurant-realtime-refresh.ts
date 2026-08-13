'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase subscribe status strings (same values as `REALTIME_SUBSCRIBE_STATES`).
 * Value-importing `@supabase/supabase-js` here makes webpack treat this client
 * module as async (`serverComponentsExternalPackages`), which marks `MenuPage`
 * async and RSC SSR throws `Element type is invalid` / got undefined.
 */
const REALTIME_SUBSCRIBE_STATUS = {
  SUBSCRIBED: 'SUBSCRIBED',
  TIMED_OUT: 'TIMED_OUT',
  CLOSED: 'CLOSED',
  CHANNEL_ERROR: 'CHANNEL_ERROR',
} as const;

/**
 * Staff surface freshness contract (production):
 * 1. Boot seed — optional SSR/demo seed; Dashboard chrome does not SSR the waiter board
 * 2. Published staff model cache — detail commits after Staff API; board clears per-table when API confirms
 * 3. Client entry reconcile — when board list is active (`useRestaurantStaffEntryReconcile`
 *    in `@/lib/use-restaurant-staff-entry-reconcile`);
 *    skip mount when boot seed is authoritative (`reconcileOnMount=false`), still resume on
 *    visibility **and window focus** (always-visible desktop after a phone mutation).
 * 4. Visibility / focus / list-active reconcile — `resolveWaiterBoardReconcileScope(floorReady)`:
 *    cold (no floor static) → full; hydrated floor → live occupancy catch-up.
 *    Pull failures are absorbed into `boardSurface` (loading | failed | ready); they must not
 *    throw unhandled — unauthorized → shared sign-out redirect; retryable cold fail → list retry UI.
 * 5. Staff menu submit return — dedicated reconcile, then strip query
 * 6. Realtime while the surface is active (`useRestaurantRealtimeRefresh`) — doorbell → live GET
 *    (occupancy slice without floor tables / opener-name resolution); merge onto floor static —
 *    see `waiter-board-live.ts` / `waiter-board-live-merge.ts`
 *    Transport also owns channel failure → backoff resubscribe on a **generation-unique** topic →
 *    one catch-up refresh on the next SUBSCRIBED (same `onRefresh` as doorbell). Intentional
 *    hide/teardown does not catch-up; attention resume (visibility/focus) stays with entry reconcile
 *    only — no second focus listener here.
 *    No interval API polling.
 * 7. Dashboard staff mutations — `WaiterBoardProvider.refreshBoardAfterStaffMutation` (full)
 * 8. Detail → list re-shown — same as (4): live when floor ready, else full (no second path)
 * 9. Table detail — board boot paints idle full model or occupied chrome stub
 *    (`buildWaiterTableDetailBootFromBoard`); only authoritative idle skips mount
 *    reconcile (`isAuthoritativeIdleWaiterTableBoot`). Occupancy refresh uses
 *    `scope=live` when board defaults exist and re-attaches that single price source
 *
 * Waiter board Realtime/entry pulls run only while the board list is visible (active);
 * other Dashboard routes keep the store dormant (mutations may still refresh).
 * Realtime never owns resume freshness: mobile tabs unsubscribe while hidden and would otherwise
 * miss cross-device closes until the next chance event.
 * No interval API polling — see `.cursor/rules/no-polling-except-fallback.mdc`.
 */

/** Debounce for Realtime → staff board signal refresh (not used for reconcile). */
export const STAFF_BOARD_SIGNAL_DEBOUNCE_MS = 2000;

/** Backoff base for channel failure → resubscribe (not API polling). */
export const REALTIME_RECONNECT_BASE_MS = 1000;

/** Cap for channel reconnect backoff. */
export const REALTIME_RECONNECT_MAX_MS = 15_000;

/**
 * Hard subscribe failures that should always resubscribe.
 * CLOSED is handled separately (often follows TIMED_OUT / intentional leave).
 */
export function isRealtimeSubscribeHardFailure(status: string): boolean {
  return (
    status === REALTIME_SUBSCRIBE_STATUS.CHANNEL_ERROR ||
    status === REALTIME_SUBSCRIBE_STATUS.TIMED_OUT
  );
}

/** Exponential backoff for the Nth reconnect attempt (0-based). */
export function realtimeReconnectDelayMs(attempt: number): number {
  const exp = Math.max(0, Math.min(attempt, 4));
  return Math.min(REALTIME_RECONNECT_BASE_MS * 2 ** exp, REALTIME_RECONNECT_MAX_MS);
}

/** Unique Realtime topic so resubscribe never reuses a half-dead channel object. */
export function realtimeChannelTopic(channelKey: string, generation: number): string {
  return `${channelKey}:${generation}`;
}

/** Entry / visibility / focus reconcile — sole export: `@/lib/use-restaurant-staff-entry-reconcile`. */

export type PostgresRealtimeBinding = {
  table: string;
  filter: string;
};

/**
 * Shared transport: subscribe while the tab is visible; debounce postgres_changes → onRefresh.
 * On CHANNEL_ERROR / TIMED_OUT (and unexpected CLOSED): backoff resubscribe on a new topic, then
 * one catch-up onRefresh when SUBSCRIBED again. Browser `online` while visible forces the same
 * recovery path. Lifecycle reconcile (mount / visibility / focus) stays in
 * `useRestaurantStaffEntryReconcile` only.
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
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let generation = 0;
    let intentionalTeardown = false;
    let catchUpOnNextSubscribed = false;
    let disposed = false;

    const scheduleRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        onRefreshRef.current();
      }, debounceMs);
    };

    const clearReconnectTimer = () => {
      if (!reconnectTimer) return;
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    };

    const scheduleReconnect = () => {
      if (disposed || document.visibilityState !== 'visible') return;
      clearReconnectTimer();
      const delay = realtimeReconnectDelayMs(reconnectAttempt);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (disposed || document.visibilityState !== 'visible') return;
        subscribe();
      }, delay);
    };

    /** Drop local ref; optionally removeChannel. Always bumps generation for the next topic. */
    const releaseChannel = (mode: 'intentional' | 'failure') => {
      const dropping = channel;
      channel = null;
      if (mode === 'intentional') {
        intentionalTeardown = true;
        catchUpOnNextSubscribed = false;
      } else {
        catchUpOnNextSubscribed = true;
      }
      if (dropping) void supabase.removeChannel(dropping);
    };

    const recoverLiveSubscription = () => {
      if (disposed || intentionalTeardown) return;
      if (document.visibilityState !== 'visible') return;
      releaseChannel('failure');
      scheduleReconnect();
    };

    const subscribe = () => {
      if (disposed || channel) return;
      if (document.visibilityState !== 'visible') return;
      intentionalTeardown = false;
      const topic = realtimeChannelTopic(channelKey, generation++);
      let next = supabase.channel(topic);
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
      channel = next.subscribe((status) => {
        // Ignore late callbacks from a channel we already dropped/replaced.
        if (disposed || channel !== next) return;
        if (status === REALTIME_SUBSCRIBE_STATUS.SUBSCRIBED) {
          reconnectAttempt = 0;
          if (catchUpOnNextSubscribed) {
            catchUpOnNextSubscribed = false;
            scheduleRefresh();
          }
          return;
        }
        if (isRealtimeSubscribeHardFailure(status)) {
          recoverLiveSubscription();
          return;
        }
        // Unexpected CLOSED while we still want the surface live (socket/channel drop).
        if (
          status === REALTIME_SUBSCRIBE_STATUS.CLOSED &&
          !intentionalTeardown &&
          document.visibilityState === 'visible'
        ) {
          recoverLiveSubscription();
        }
      });
    };

    const unsubscribe = () => {
      clearReconnectTimer();
      reconnectAttempt = 0;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      releaseChannel('intentional');
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') subscribe();
      else unsubscribe();
    };

    /** Recover zombie sockets that never emit CLOSED while the tab stayed visible. */
    const onOnline = () => {
      if (disposed || document.visibilityState !== 'visible') return;
      releaseChannel('intentional');
      intentionalTeardown = false;
      catchUpOnNextSubscribed = true;
      reconnectAttempt = 0;
      clearReconnectTimer();
      subscribe();
    };

    if (document.visibilityState === 'visible') subscribe();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      unsubscribe();
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
