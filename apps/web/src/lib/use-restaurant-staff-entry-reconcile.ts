'use client';

import { useEffect, useRef } from 'react';

/**
 * Reconcile authoritative read-models when a surface becomes active:
 * mount / entry navigation (optional), and document visible after being hidden.
 *
 * Lives in its own module (no `@supabase/supabase-js`) so customer menu SSR can
 * call it without pulling the Realtime transport chunk — that async client-module
 * edge was surfacing as `Element type is invalid` during menu hydration.
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
