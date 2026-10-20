'use client';

import { useMemo, useState } from 'react';
import { resolveSessionMenuTimeSlotId, type MenuTimeSlot } from '@/lib/menu-time-slot';

/** Guest/staff menu slot for this table: fixed by session `opened_at`; browse-only → mount time. */
export function useSessionMenuTimeSlotId(
  menuTimeSlots: readonly MenuTimeSlot[],
  sessionOpenedAt: string | null | undefined,
): string | null {
  const [mountedAt] = useState(() => new Date());
  return useMemo(
    () => resolveSessionMenuTimeSlotId(menuTimeSlots, sessionOpenedAt, mountedAt),
    [menuTimeSlots, sessionOpenedAt, mountedAt],
  );
}
