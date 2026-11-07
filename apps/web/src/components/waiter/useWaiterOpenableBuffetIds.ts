'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CheckoutEntrySignals } from '@/lib/buffet-checkout-entry';
import { fetchWaiterBuffetChoicesClient } from '@/lib/staff-board-client';
import type { Buffet } from '@/types';

/**
 * Sole client read of「当前可开的套餐」+ the table's checkout-entry signals
 * (GET …/staff/waiter/buffet): one fetch per mount / table, `refresh` after a 409.
 * null while loading / on failure; `checkoutEntry` null when the table has no session.
 */
export function useWaiterOpenableBuffetIds(
  restaurantSlug: string,
  enabled: boolean,
  tableId: string | null = null,
) {
  const [openableBuffetIds, setOpenableBuffetIds] = useState<string[] | null>(null);
  const [checkoutEntry, setCheckoutEntry] = useState<CheckoutEntrySignals | null>(null);

  const refresh = useCallback(async () => {
    try {
      const choices = await fetchWaiterBuffetChoicesClient(restaurantSlug, tableId);
      setOpenableBuffetIds(choices.openableBuffetIds);
      setCheckoutEntry(choices.checkoutEntry);
    } catch {
      setOpenableBuffetIds(null);
      setCheckoutEntry(null);
    }
  }, [restaurantSlug, tableId]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return { openableBuffetIds, checkoutEntry, refreshOpenableBuffetIds: refresh };
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
