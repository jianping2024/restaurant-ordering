'use client';

/**
 * Menu-page ordering hold for individual-checkout sessions: this phone called checkout for its own
 * ticket(s), so it cannot add dishes until it resumes (unlocks) or the ticket is paid.
 * Server write endpoints enforce the same rule; this only drives the banner / early toast.
 */
import { useCallback, useEffect, useState } from 'react';
import { useGuestClientId } from '@/lib/table-order-round/use-guest-client-id';

export function useIndividualCheckoutHold(params: {
  slug: string;
  restaurantId: string;
  tableId: string;
  sessionId: string | null | undefined;
  /** False for demo tables and staff-assisted ordering (waiter flow never holds). */
  enabled: boolean;
}) {
  const { slug, restaurantId, tableId, sessionId, enabled } = params;
  const guestClientId = useGuestClientId(restaurantId, tableId);
  const [hold, setHold] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !guestClientId || !sessionId) {
      setHold(false);
      return;
    }
    try {
      const search = new URLSearchParams({
        table_id: tableId,
        guest_client_id: guestClientId,
      });
      const res = await fetch(
        `/api/restaurants/${encodeURIComponent(slug)}/customer/individual-hold?${search.toString()}`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { hold?: boolean };
      setHold(data.hold === true);
    } catch {
      /* keep the last known value */
    }
  }, [enabled, guestClientId, sessionId, slug, tableId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [enabled, refresh]);

  const markHold = useCallback(() => setHold(true), []);

  return { guestClientId, hold, markHold, refresh };
}
