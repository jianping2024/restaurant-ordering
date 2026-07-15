'use client';

import { useCallback, useEffect, useState } from 'react';

export const STAFF_RECEIPT_PRINT_COOLDOWN_MS = 10_000;

/** Per-action cooldown keys (bill vs split receipt) so staff can reprint after 10s. */
export function useStaffReceiptPrintCooldown() {
  const [cooldownUntilById, setCooldownUntilById] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    const hasActive = Object.values(cooldownUntilById).some((until) => until > Date.now());
    if (!hasActive) return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntilById]);

  const cooldownSecondsLeft = useCallback(
    (cooldownKey: string) => {
      const until = cooldownUntilById[cooldownKey] ?? 0;
      const left = Math.ceil((until - Date.now()) / 1000);
      return left > 0 ? left : 0;
    },
    [cooldownUntilById],
  );

  const isOnCooldown = useCallback(
    (cooldownKey: string) => cooldownSecondsLeft(cooldownKey) > 0,
    [cooldownSecondsLeft],
  );

  const startCooldown = useCallback((cooldownKey: string) => {
    setCooldownUntilById((prev) => ({
      ...prev,
      [cooldownKey]: Date.now() + STAFF_RECEIPT_PRINT_COOLDOWN_MS,
    }));
  }, []);

  return { cooldownSecondsLeft, isOnCooldown, startCooldown };
}
