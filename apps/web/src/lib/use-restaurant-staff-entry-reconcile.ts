'use client';

import { useEffect, useRef } from 'react';

/**
 * Reconcile authoritative read-models when a surface becomes active:
 * mount / entry navigation (optional), document visible after being hidden,
 * and window focus while already visible (e.g. phone mutated → operator looks
 * at a desktop board that never fired visibilitychange).
 *
 * Lives in its own module (no `@supabase/supabase-js`) so customer menu SSR can
 * call it without pulling the Realtime transport chunk — that async client-module
 * edge was surfacing as `Element type is invalid` during menu hydration.
 *
 * Sole lifecycle catch-up path for staff/customer surfaces that use this hook.
 * Realtime owns doorbell + reconnect catch-up only — do not add a second focus
 * listener on the transport.
 */

/** Coalesce rapid window focus (alt-tab / click chrome) into one pull. */
export const STAFF_ENTRY_FOCUS_RECONCILE_DEBOUNCE_MS = 400;

/** Foreground gate shared by visibility + focus resume. */
export function shouldReconcileStaffSurfaceOnAttention(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
}

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

    let focusTimer: ReturnType<typeof setTimeout> | null = null;

    const runResume = () => {
      if (!shouldReconcileStaffSurfaceOnAttention()) return;
      void refreshRef.current();
    };

    const onVisibility = () => {
      if (!shouldReconcileStaffSurfaceOnAttention()) return;
      if (focusTimer) {
        clearTimeout(focusTimer);
        focusTimer = null;
      }
      runResume();
    };

    const onFocus = () => {
      if (!shouldReconcileStaffSurfaceOnAttention()) return;
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        focusTimer = null;
        runResume();
      }, STAFF_ENTRY_FOCUS_RECONCILE_DEBOUNCE_MS);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [enabled, entryKey]);
}
