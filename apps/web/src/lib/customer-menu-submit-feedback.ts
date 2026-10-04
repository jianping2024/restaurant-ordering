import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sole guest-menu submit success feedback: the footer primary action turns into a
 * ✓ status pill for {@link CUSTOMER_MENU_SUBMIT_FEEDBACK_MS} and the ordered bag
 * badge pops — in place of a success toast that would cover the footer CTA.
 * Failures / hints still use `showToast` (lifted above the dock).
 */
export type CustomerMenuSubmitFeedback = {
  /** Bumps per signal so repeat successes re-trigger the badge pop. */
  key: number;
  message: string;
};

export const CUSTOMER_MENU_SUBMIT_FEEDBACK_MS = 2000;

export function useCustomerMenuSubmitFeedback(): {
  submitFeedback: CustomerMenuSubmitFeedback | null;
  signalSubmitFeedback: (message: string) => void;
} {
  const [submitFeedback, setSubmitFeedback] = useState<CustomerMenuSubmitFeedback | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef(0);

  const signalSubmitFeedback = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lastKeyRef.current += 1;
    setSubmitFeedback({ key: lastKeyRef.current, message });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setSubmitFeedback(null);
    }, CUSTOMER_MENU_SUBMIT_FEEDBACK_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { submitFeedback, signalSubmitFeedback };
}
