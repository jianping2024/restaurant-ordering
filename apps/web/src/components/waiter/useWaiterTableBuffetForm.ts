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

export type BuffetFormLifecycle = 'ephemeral' | 'persistent';

type Params = {
  tableId: string;
  sessionId: string | null;
  alignState: BuffetFormAlignState;
  restaurantId: string;
  activeBuffets: Buffet[];
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
  isDemo: boolean;
  supabase: SupabaseClient;
  /** Ephemeral: board open-table sheet. Persistent: occupied table detail. */
  lifecycle?: BuffetFormLifecycle;
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

function resolvedPricesForActiveBuffets(
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
  activeBuffetIds: string[],
): Record<string, ResolvedBuffetPriceRow | null> {
  const next: Record<string, ResolvedBuffetPriceRow | null> = {};
  for (const buffetId of activeBuffetIds) {
    next[buffetId] = buffetPricesByBuffetId[buffetId] ?? null;
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
  lifecycle = 'persistent',
}: Params) {
  const isEphemeral = lifecycle === 'ephemeral';
  const activeBuffetIds = useMemo(() => activeBuffets.map((b) => b.id), [activeBuffets]);

  const [guestSnapshot, setGuestSnapshot] = useState<BuffetGuestSnapshot>(() =>
    isEphemeral ? buildIdleBuffetDraftSnapshot(activeBuffets.map((b) => b.id)) : {},
  );
  const [resolvedByBuffetId, setResolvedByBuffetId] = useState<
    Record<string, ResolvedBuffetPriceRow | null>
  >(() =>
    isEphemeral
      ? resolvedPricesForActiveBuffets(buffetPricesByBuffetId, activeBuffets.map((b) => b.id))
      : {},
  );
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

    if (alignState.mode === 'session_open') {
      setGuestSnapshot(buildIdleBuffetDraftSnapshot(alignState.activeBuffetIds));
      return;
    }

    setGuestSnapshot(buildIdleBuffetDraftSnapshot(activeBuffetIds));
  }, [activeBuffetIds, activeBuffets, alignKey, alignState]);

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
      setResolvedByBuffetId(resolvedPricesForActiveBuffets(nextResolved, activeBuffetIds));
    },
    [activeBuffetIds, buffetPricesByBuffetId, isDemo, restaurantId, supabase],
  );

  useBuffetPricesRealtimeRefresh(
    supabase,
    restaurantId,
    !isDemo && !isEphemeral && activeBuffetIds.length > 0,
    () => {
      void fetchBuffetPrices(true);
    },
  );

  useEffect(() => {
    if (isDemo || activeBuffetIds.length === 0) {
      if (!isEphemeral) {
        setResolvedByBuffetId({});
      }
      setPriceLoading(false);
      return;
    }

    if (isEphemeral) {
      const seeded = resolvedPricesForActiveBuffets(buffetPricesByBuffetId, activeBuffetIds);
      const missingIds = activeBuffetIds.filter((id) => !seeded[id]);
      if (missingIds.length === 0) {
        setResolvedByBuffetId(seeded);
        setPriceLoading(false);
        return;
      }

      let cancelled = false;
      void (async () => {
        await fetchBuffetPrices(false);
        if (!cancelled) setPriceLoading(false);
      })();

      return () => {
        cancelled = true;
      };
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
  }, [activeBuffetIds, buffetPricesByBuffetId, fetchBuffetPrices, isDemo, isEphemeral]);

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
