'use client';

import { useCallback, useEffect, useState } from 'react';
import { clampOrderCooldownSeconds } from '@/lib/order-submit-cooldown-client';

/** Per-device menu submit button cooldown after each successful append. */
export function useSubmitCooldownRemaining(orderCooldownSeconds: number) {
  const [remaining, setRemaining] = useState(0);
  const configSeconds = clampOrderCooldownSeconds(orderCooldownSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [remaining]);

  const restartSubmitCooldown = useCallback(() => {
    setRemaining(configSeconds);
  }, [configSeconds]);

  return {
    submitCooldownRemaining: remaining,
    isSubmitCooldownActive: remaining > 0,
    restartSubmitCooldown,
  };
}
