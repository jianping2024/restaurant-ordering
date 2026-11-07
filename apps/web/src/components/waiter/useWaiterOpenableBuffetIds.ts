'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchWaiterOpenableBuffetIdsClient } from '@/lib/staff-board-client';
import type { Buffet } from '@/types';

/**
 * Sole client read of「当前可开的套餐」(GET …/staff/waiter/buffet): one fetch per mount,
 * `refresh` after a 409 `buffet_not_available_now`. null while loading / on failure.
 */
export function useWaiterOpenableBuffetIds(restaurantSlug: string, enabled: boolean) {
  const [openableBuffetIds, setOpenableBuffetIds] = useState<string[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setOpenableBuffetIds(await fetchWaiterOpenableBuffetIdsClient(restaurantSlug));
    } catch {
      setOpenableBuffetIds(null);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return { openableBuffetIds, refreshOpenableBuffetIds: refresh };
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
