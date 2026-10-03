'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

/**
 * Sole guest-bill signal that a consumer-name field is focused.
 * BillPage hides fixed「呼叫结账」while active (same chrome yield as custom-amount edit).
 */
type GuestConsumerNameEditChrome = {
  reportActive: (active: boolean) => void;
};

const GuestConsumerNameEditChromeContext =
  createContext<GuestConsumerNameEditChrome | null>(null);

export function GuestConsumerNameEditChromeProvider({
  children,
  onActiveChange,
}: {
  children: ReactNode;
  onActiveChange: (active: boolean) => void;
}) {
  const countRef = useRef(0);
  const reportActive = useCallback(
    (active: boolean) => {
      const prev = countRef.current;
      countRef.current = Math.max(0, prev + (active ? 1 : -1));
      const wasActive = prev > 0;
      const nextActive = countRef.current > 0;
      if (wasActive !== nextActive) onActiveChange(nextActive);
    },
    [onActiveChange],
  );
  const value = useMemo(() => ({ reportActive }), [reportActive]);
  return (
    <GuestConsumerNameEditChromeContext.Provider value={value}>
      {children}
    </GuestConsumerNameEditChromeContext.Provider>
  );
}

/** No-op outside the guest bill provider (staff surfaces do not mount the provider). */
export function useReportGuestConsumerNameEditActive(): (active: boolean) => void {
  const ctx = useContext(GuestConsumerNameEditChromeContext);
  return ctx?.reportActive ?? (() => {});
}
