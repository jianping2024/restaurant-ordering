'use client';

import { useCallback, useEffect, useState } from 'react';

export const CHECKOUT_BILL_PRINT_COOLDOWN_MS = 20_000;

/** Per bill_split_id cooldown so staff can reprint after 20s without duplicate rapid clicks. */
export function useCheckoutBillPrintCooldown() {
  const [cooldownUntilById, setCooldownUntilById] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    const hasActive = Object.values(cooldownUntilById).some((until) => until > Date.now());
    if (!hasActive) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntilById]);

  const cooldownSecondsLeft = useCallback(
    (billSplitId: string) => {
      const until = cooldownUntilById[billSplitId] ?? 0;
      const left = Math.ceil((until - Date.now()) / 1000);
      return left > 0 ? left : 0;
    },
    [cooldownUntilById],
  );

  const isOnCooldown = useCallback(
    (billSplitId: string) => cooldownSecondsLeft(billSplitId) > 0,
    [cooldownSecondsLeft],
  );

  const startCooldown = useCallback((billSplitId: string) => {
    setCooldownUntilById((prev) => ({
      ...prev,
      [billSplitId]: Date.now() + CHECKOUT_BILL_PRINT_COOLDOWN_MS,
    }));
  }, []);

  return { cooldownSecondsLeft, isOnCooldown, startCooldown };
}
