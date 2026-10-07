'use client';

/**
 * Realtime doorbell for individual-checkout sessions: `table_checkout_signals` INSERT (anon
 * SELECT via RLS session check) → read the rows newer than the last one seen → `onSignals`.
 * The shared transport (reconnect / catch-up) is {@link useDebouncedPostgresRealtimeRefresh};
 * rows are batched per debounce window so several calls merge into one notice.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createGuestClient } from '@/lib/supabase/guest-client';
import type { IndividualCheckoutSignal } from '@/lib/individual-call-notice';
import { useDebouncedPostgresRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';

const EPOCH = '1970-01-01T00:00:00.000Z';
const SIGNAL_SELECT = 'id, kind, reason, ticket_key, name, items, created_at';
const DEBOUNCE_MS = 400;

export function useIndividualCheckoutSignals(params: {
  sessionId: string | null | undefined;
  enabled: boolean;
  onSignals: (rows: IndividualCheckoutSignal[]) => void;
}) {
  const { sessionId, enabled, onSignals } = params;
  const supabase = useMemo(() => createGuestClient(), []);
  const onSignalsRef = useRef(onSignals);
  onSignalsRef.current = onSignals;
  /** Newest created_at already delivered; null until the mount baseline is read. */
  const lastSeenRef = useRef<string | null>(null);
  const active = enabled && !!sessionId;

  // Baseline: only signals created after this phone opened the page are delivered.
  useEffect(() => {
    lastSeenRef.current = null;
    if (!active || !sessionId) return;
    let cancelled = false;
    void supabase
      .from('table_checkout_signals')
      .select('created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        lastSeenRef.current = (data?.created_at as string | undefined) ?? EPOCH;
      });
    return () => {
      cancelled = true;
    };
  }, [active, sessionId, supabase]);

  const pull = useCallback(async () => {
    if (!sessionId) return;
    // Baseline not read yet: treat the doorbell as a plain refresh with no rows.
    const since = lastSeenRef.current;
    if (since == null) {
      onSignalsRef.current([]);
      return;
    }
    const { data, error } = await supabase
      .from('table_checkout_signals')
      .select(SIGNAL_SELECT)
      .eq('session_id', sessionId)
      .gt('created_at', since)
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) {
      onSignalsRef.current([]);
      return;
    }
    const rows = (data ?? []) as IndividualCheckoutSignal[];
    if (rows.length > 0) lastSeenRef.current = rows[rows.length - 1]!.created_at;
    onSignalsRef.current(rows);
  }, [sessionId, supabase]);

  useDebouncedPostgresRealtimeRefresh(
    supabase,
    `individual-checkout-signals:${sessionId ?? 'none'}`,
    active,
    [{ table: 'table_checkout_signals', filter: `session_id=eq.${sessionId ?? ''}` }],
    () => void pull(),
    DEBOUNCE_MS,
  );

  // Back from the background: signals missed while hidden refresh the data (stale ones skip the modal).
  useEffect(() => {
    if (!active) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [active, pull]);
}
