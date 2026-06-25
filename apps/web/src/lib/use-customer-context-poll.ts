'use client';

import { useCallback, useEffect, useRef } from 'react';

/** Poll while a table session is open (order / dish status sync). */
export const CUSTOMER_CONTEXT_POLL_MS_ACTIVE = 20_000;

/** Poll before session exists (wait for waiter to open the table). */
export const CUSTOMER_CONTEXT_POLL_MS_IDLE = 30_000;

type Options = {
  enabled: boolean;
  /** When false, uses the slower idle interval (menu page before open). */
  hasActiveSession: boolean;
  onPoll: () => void | Promise<void>;
};

/**
 * Visibility-aware customer context polling (Plan A).
 * Pauses while the tab is hidden; refetches immediately when visible again.
 */
export function useCustomerContextPoll({ enabled, hasActiveSession, onPoll }: Options) {
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  const refresh = useCallback(() => {
    void onPollRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const pollMs = hasActiveSession
      ? CUSTOMER_CONTEXT_POLL_MS_ACTIVE
      : CUSTOMER_CONTEXT_POLL_MS_IDLE;

    const clearPollInterval = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const startPollInterval = () => {
      clearPollInterval();
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          void onPollRef.current();
        }
      }, pollMs);
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        clearPollInterval();
        return;
      }
      void onPollRef.current();
      startPollInterval();
    };

    if (document.visibilityState === 'visible') {
      void onPollRef.current();
      startPollInterval();
    }
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearPollInterval();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, hasActiveSession]);

  return { refresh };
}
