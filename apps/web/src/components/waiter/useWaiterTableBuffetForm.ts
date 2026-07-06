'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildIdleBuffetDraftSnapshot,
  buffetFormAlignKey,
  buffetSnapshotKey,
  parseResolvedBuffetPriceRpcRow,
  type BuffetFormAlignState,
  type BuffetGuestSnapshot,
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

function mergeSnapshotWithActiveBuffets(
  snapshot: BuffetGuestSnapshot,
  activeBuffets: Buffet[],
): BuffetGuestSnapshot {
  const next: BuffetGuestSnapshot = {};
  for (const buffet of activeBuffets) {
    next[buffet.id] = snapshot[buffet.id] ?? { adults: 0, children: 0 };
  }
  return next;
}

/** Multi-package buffet draft — aligns from alignState when table context is authoritative. */
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
  const activeBuffetIds = useMemo(() => activeBuffets.map((b) => b.id), [activeBuffets]);
  const defaultBuffetId = activeBuffets[0]?.id ?? null;

  const [guestSnapshot, setGuestSnapshot] = useState<BuffetGuestSnapshot>({});
  const [resolvedByBuffetId, setResolvedByBuffetId] = useState<
    Record<string, ResolvedBuffetPriceRow | null>
  >({});
  const [priceLoading, setPriceLoading] = useState(false);
  const lastAlignedKeyRef = useRef<string | null>(null);

  const alignKey = useMemo(
    () => buffetFormAlignKey(tableId, sessionId, alignState),
    [alignState, sessionId, tableId],
  );

  useEffect(() => {
    if (lastAlignedKeyRef.current === alignKey) return;
    lastAlignedKeyRef.current = alignKey;

    if (alignState.mode === 'pending') return;

    if (alignState.mode === 'occupied') {
      setGuestSnapshot(mergeSnapshotWithActiveBuffets(alignState.snapshot, activeBuffets));
      return;
    }

    setGuestSnapshot(
      buildIdleBuffetDraftSnapshot(activeBuffetIds, alignState.defaultBuffetId ?? defaultBuffetId),
    );
  }, [activeBuffetIds, activeBuffets, alignKey, alignState, defaultBuffetId]);

  const fetchBuffetPrices = useCallback(
    async (silent: boolean) => {
      if (isDemo || activeBuffetIds.length === 0) return;

      if (!silent) setPriceLoading(true);

      const nextResolved: Record<string, ResolvedBuffetPriceRow | null> = {
        ...buffetPricesByBuffetId,
      };

      await Promise.all(
        activeBuffetIds.map(async (buffetId) => {
          if (buffetPricesByBuffetId[buffetId]) {
            nextResolved[buffetId] = buffetPricesByBuffetId[buffetId];
            return;
          }

          const { data: priceRows, error } = await supabase.rpc('resolve_buffet_prices', {
            p_restaurant_id: restaurantId,
            p_buffet_id: buffetId,
            p_at: new Date().toISOString(),
          });
          if (error) {
            nextResolved[buffetId] = null;
            return;
          }
          nextResolved[buffetId] = parseResolvedBuffetPriceRpcRow(priceRows);
        }),
      );

      if (!silent) setPriceLoading(false);
      setResolvedByBuffetId(nextResolved);
    },
    [activeBuffetIds, buffetPricesByBuffetId, isDemo, restaurantId, supabase],
  );

  useBuffetPricesRealtimeRefresh(supabase, restaurantId, !isDemo && activeBuffetIds.length > 0, () => {
    void fetchBuffetPrices(true);
  });

  useEffect(() => {
    if (isDemo || activeBuffetIds.length === 0) {
      setResolvedByBuffetId({});
      setPriceLoading(false);
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
        await fetchBuffetPrices(true);
        scheduleMinute();
      }, ms);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchBuffetPrices(true);
        scheduleMinute();
      } else {
        clearMinute();
      }
    };

    void fetchBuffetPrices(Object.keys(buffetPricesByBuffetId).length > 0);

    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState === 'visible') scheduleMinute();

    return () => {
      cancelled = true;
      clearMinute();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeBuffetIds, buffetPricesByBuffetId, fetchBuffetPrices, isDemo]);

  const setBuffetGuestCount = useCallback(
    (buffetId: string, which: 'adults' | 'children', value: number) => {
      const n = Math.max(0, Math.floor(value));
      setGuestSnapshot((prev) => ({
        ...prev,
        [buffetId]: {
          adults: which === 'adults' ? n : (prev[buffetId]?.adults ?? 0),
          children: which === 'children' ? n : (prev[buffetId]?.children ?? 0),
        },
      }));
    },
    [],
  );

  const draftSnapshotKey = useMemo(() => buffetSnapshotKey(guestSnapshot), [guestSnapshot]);

  return {
    guestSnapshot,
    draftSnapshotKey,
    setBuffetGuestCount,
    resolvedByBuffetId,
    priceLoading,
  };
}
