'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buffetFormAlignKey,
  parseResolvedBuffetPriceRpcRow,
  type BuffetFormAlignState,
  type ResolvedBuffetPriceRow,
  type TableBuffetSelection,
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

/**
 * Draft the form should show for an align state; undefined while table context is pending.
 * Idle / no-buffet session preselects the default package at 0 + 0.
 */
function draftFromAlignState(
  alignState: BuffetFormAlignState,
): TableBuffetSelection | null | undefined {
  if (alignState.mode === 'pending') return undefined;
  if (alignState.mode === 'occupied') return alignState.selection;
  return alignState.defaultBuffetId
    ? { buffetId: alignState.defaultBuffetId, adults: 0, children: 0 }
    : null;
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

/** One-buffet table draft — aligns from alignState when table context is authoritative. */
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

  const [draft, setDraft] = useState<TableBuffetSelection | null>(
    () => draftFromAlignState(alignState) ?? null,
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

  const alignedDraft = useMemo(() => draftFromAlignState(alignState), [alignState]);
  const alignedDraftRef = useRef(alignedDraft);
  alignedDraftRef.current = alignedDraft;

  useEffect(() => {
    if (lastAlignedKeyRef.current === alignKey) return;
    lastAlignedKeyRef.current = alignKey;
    if (alignedDraft !== undefined) setDraft(alignedDraft);
  }, [alignKey, alignedDraft]);

  /** Drop an unsaved edit and show the table's authoritative headcount again. */
  const resetDraftToAligned = useCallback(() => {
    const next = alignedDraftRef.current;
    if (next !== undefined) setDraft(next);
  }, []);

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

  /** Pick the table's one package; headcount carries over. */
  const selectBuffet = useCallback((buffetId: string) => {
    setDraft((prev) => ({
      buffetId,
      adults: prev?.adults ?? 0,
      children: prev?.children ?? 0,
    }));
  }, []);

  const setBuffetGuestCount = useCallback((which: 'adults' | 'children', value: number) => {
    const n = Math.max(0, Math.floor(value));
    setDraft((prev) => (prev ? { ...prev, [which]: n } : prev));
  }, []);

  return {
    draft,
    selectBuffet,
    setBuffetGuestCount,
    resetDraftToAligned,
    resolvedByBuffetId,
    priceLoading,
  };
}
