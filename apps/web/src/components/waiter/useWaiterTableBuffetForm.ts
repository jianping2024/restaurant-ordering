'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buffetFormAlignKey,
  IDLE_BUFFET_FORM_DEFAULTS,
  parseResolvedBuffetPriceRpcRow,
  type BuffetFormAlignState,
  type ResolvedBuffetPriceRow,
} from '@/lib/buffet-order';
import { useBuffetPricesRealtimeRefresh } from '@/lib/use-buffet-prices-realtime-refresh';
import type { Buffet } from '@/types';

type Params = {
  tableId: string;
  sessionId: string | null;
  alignState: BuffetFormAlignState;
  restaurantId: string;
  activeBuffets: Buffet[];
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
  isDemo: boolean;
  supabase: SupabaseClient;
};

/** Buffet open-table form — draft state; aligns from alignState when table context is authoritative. */
export function useWaiterTableBuffetForm({
  tableId,
  sessionId,
  alignState,
  restaurantId,
  activeBuffets,
  buffetPricesByBuffetId,
  isDemo,
  supabase,
}: Params) {
  const defaultBuffetId = activeBuffets[0]?.id ?? '';
  const [buffetId, setBuffetId] = useState(defaultBuffetId);
  const [buffetAdults, setBuffetAdults] = useState<number>(IDLE_BUFFET_FORM_DEFAULTS.adults);
  const [buffetChildren, setBuffetChildren] = useState<number>(IDLE_BUFFET_FORM_DEFAULTS.children);
  const [buffetResolved, setBuffetResolved] = useState<ResolvedBuffetPriceRow | null>(null);
  const [buffetPriceLoading, setBuffetPriceLoading] = useState(false);
  const lastAlignedKeyRef = useRef<string | null>(null);

  const alignKey = useMemo(
    () => buffetFormAlignKey(tableId, sessionId, alignState),
    [alignState, sessionId, tableId],
  );

  const selectedBuffet = useMemo(
    () => activeBuffets.find((b) => b.id === buffetId) ?? activeBuffets[0] ?? null,
    [activeBuffets, buffetId],
  );

  useEffect(() => {
    if (lastAlignedKeyRef.current === alignKey) return;
    lastAlignedKeyRef.current = alignKey;

    if (alignState.mode === 'pending') return;

    if (alignState.mode === 'occupied') {
      setBuffetId(alignState.seed.buffetId);
      setBuffetAdults(alignState.seed.adults);
      setBuffetChildren(alignState.seed.children);
      return;
    }

    if (alignState.defaultBuffetId) setBuffetId(alignState.defaultBuffetId);
    setBuffetAdults(IDLE_BUFFET_FORM_DEFAULTS.adults);
    setBuffetChildren(IDLE_BUFFET_FORM_DEFAULTS.children);
  }, [alignKey, alignState]);

  useEffect(() => {
    if (activeBuffets.length === 0) return;
    if (!buffetId || !activeBuffets.some((b) => b.id === buffetId)) {
      setBuffetId(activeBuffets[0].id);
    }
  }, [activeBuffets, buffetId]);

  const fetchBuffetPrice = useCallback(
    async (targetBuffetId: string, silent: boolean) => {
      if (isDemo || !targetBuffetId) return;

      const seeded = buffetPricesByBuffetId[targetBuffetId];
      if (seeded) {
        setBuffetResolved(seeded);
        setBuffetPriceLoading(false);
        return;
      }

      if (!silent) setBuffetPriceLoading(true);
      const { data: priceRows, error } = await supabase.rpc('resolve_buffet_prices', {
        p_restaurant_id: restaurantId,
        p_buffet_id: targetBuffetId,
        p_at: new Date().toISOString(),
      });
      if (!silent) setBuffetPriceLoading(false);
      if (error) {
        if (!silent) setBuffetResolved(null);
        return;
      }
      setBuffetResolved(parseResolvedBuffetPriceRpcRow(priceRows));
    },
    [buffetPricesByBuffetId, isDemo, restaurantId, supabase],
  );

  useBuffetPricesRealtimeRefresh(
    supabase,
    restaurantId,
    !isDemo && !!buffetId,
    () => {
      void fetchBuffetPrice(buffetId, true);
    },
  );

  useEffect(() => {
    if (isDemo || !buffetId) {
      setBuffetResolved(null);
      setBuffetPriceLoading(false);
      return;
    }

    let cancelled = false;
    let minuteTimer: number | null = null;

    const clearMinute = () => {
      if (minuteTimer != null) {
        window.clearTimeout(minuteTimer);
        minuteTimer = null;
      }
    };

    const scheduleMinute = () => {
      clearMinute();
      if (cancelled || document.visibilityState !== 'visible') return;
      const jitterMs = 20;
      const ms = Math.max(jitterMs, 60_000 - (Date.now() % 60_000) + jitterMs);
      minuteTimer = window.setTimeout(async () => {
        minuteTimer = null;
        if (cancelled || document.visibilityState !== 'visible') return;
        await fetchBuffetPrice(buffetId, true);
        scheduleMinute();
      }, ms);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchBuffetPrice(buffetId, true);
        scheduleMinute();
      } else {
        clearMinute();
      }
    };

    const seeded = !!buffetPricesByBuffetId[buffetId];
    void fetchBuffetPrice(buffetId, seeded);

    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'visible') scheduleMinute();

    return () => {
      cancelled = true;
      clearMinute();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [buffetId, buffetPricesByBuffetId, fetchBuffetPrice, isDemo]);

  const setBuffetGuestCount = useCallback((which: 'adults' | 'children', value: number) => {
    const n = Math.max(0, Math.floor(value));
    if (which === 'adults') setBuffetAdults(n);
    else setBuffetChildren(n);
  }, []);

  return {
    buffetId,
    setBuffetId,
    selectedBuffet,
    buffetAdults,
    buffetChildren,
    setBuffetGuestCount,
    buffetResolved,
    buffetPriceLoading,
  };
}
