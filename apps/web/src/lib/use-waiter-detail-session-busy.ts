'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Sole in-flight mutex for waiter table-detail session writes.
 * One kind at a time; siblings disable via `busy`, owner chrome via `kind`.
 */
export type WaiterDetailSessionBusyKind =
  | 'call_checkout'
  | 'force_close'
  | 'transfer_merge'
  | 'order_line'
  | 'buffet_open'
  | 'pre_bill'
  | 'demo_close';

export function useWaiterDetailSessionBusy() {
  const kindRef = useRef<WaiterDetailSessionBusyKind | null>(null);
  const [kind, setKind] = useState<WaiterDetailSessionBusyKind | null>(null);

  const tryBegin = useCallback((next: WaiterDetailSessionBusyKind) => {
    if (kindRef.current) return false;
    kindRef.current = next;
    setKind(next);
    return true;
  }, []);

  const end = useCallback(() => {
    kindRef.current = null;
    setKind(null);
  }, []);

  return {
    busy: kind != null,
    kind,
    tryBegin,
    end,
  };
}
