'use client';

import { useEffect, useState } from 'react';
import { ensureGuestClientId } from '@/lib/table-order-round/guest-client';

/** Sole React hook wrapping ensureGuestClientId. */
export function useGuestClientId(restaurantId: string, tableId: string): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = ensureGuestClientId(restaurantId, tableId);
    setId(next || null);
  }, [restaurantId, tableId]);

  return id;
}
