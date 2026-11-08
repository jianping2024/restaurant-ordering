'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CheckoutEntrySignals } from '@/lib/buffet-checkout-entry';
import type { ResolvedBuffetPriceRow } from '@/lib/buffet-order';
import {
  ensureWaiterOpenable,
  peekWaiterOpenableCache,
  type WaiterOpenableCacheEntry,
} from '@/lib/waiter-buffet-openable-client-cache';
import type { Buffet } from '@/types';

const EMPTY_PRICES: Record<string, ResolvedBuffetPriceRow> = {};

function snapshotFromCache(restaurantId: string): WaiterOpenableCacheEntry | null {
  return restaurantId ? peekWaiterOpenableCache(restaurantId) : null;
}

/**
 * Sole client read of「当前可开的套餐」+ optional table checkout-entry signals.
 * Paints from local cache immediately when warm; reconciles via version + current slot
 * (`ensureWaiterOpenable` → GET …/staff/waiter/buffet knownVersion/knownSlotKey).
 * `refresh` after a 409.
 */
export function useWaiterOpenableBuffetIds(
  restaurantId: string,
  restaurantSlug: string,
  enabled: boolean,
  tableId: string | null = null,
) {
  const [cached, setCached] = useState<WaiterOpenableCacheEntry | null>(() =>
    snapshotFromCache(restaurantId),
  );
  const [checkoutEntry, setCheckoutEntry] = useState<CheckoutEntrySignals | null>(null);

  const refresh = useCallback(async () => {
    if (!restaurantId || !restaurantSlug) return;
    try {
      const result = await ensureWaiterOpenable({
        restaurantId,
        slug: restaurantSlug,
        tableId,
      });
      setCached({
        version: result.version,
        slotKey: result.slotKey,
        openableBuffetIds: result.openableBuffetIds,
        pricesByBuffetId: result.pricesByBuffetId,
      });
      setCheckoutEntry(result.checkoutEntry);
    } catch {
      // Keep last good cache for paint; only clear when we had nothing.
      if (!peekWaiterOpenableCache(restaurantId)) {
        setCached(null);
      }
      setCheckoutEntry(null);
    }
  }, [restaurantId, restaurantSlug, tableId]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return {
    openableBuffetIds: cached ? cached.openableBuffetIds : null,
    openablePricesByBuffetId: cached?.pricesByBuffetId ?? EMPTY_PRICES,
    checkoutEntry,
    refreshOpenableBuffetIds: refresh,
  };
}

/**
 * Packages the waiter can pick: active + openable now, plus the table's current package
 * (kept even if since disabled / out of slot — headcount stays adjustable).
 */
export function pickableBuffetOptions(
  buffets: readonly Buffet[],
  openableBuffetIds: readonly string[] | null,
  currentBuffetId: string | null,
): Buffet[] {
  return buffets.filter(
    (b) =>
      b.id === currentBuffetId
      || (b.is_active && (openableBuffetIds ?? []).includes(b.id)),
  );
}
