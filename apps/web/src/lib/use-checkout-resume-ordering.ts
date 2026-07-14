'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CHECKOUT_REDIRECT_TIMEOUT_MS } from '@/lib/checkout-request-submit';
import { requestCheckoutResumeOrdering } from '@/lib/request-checkout-resume-ordering';
import { waiterTableHref } from '@/lib/staff-routes';

export type CheckoutResumeOrderingPhase = 'idle' | 'mutating' | 'exiting';

type Messages = {
  failed: string;
  blockedWholeTable: string;
  success: string;
  redirectTimeout?: string;
};

type Params = {
  restaurantSlug: string;
  tableId: string;
  exitHref?: string;
  onMutated?: (tableId: string) => void;
  showToast: (message: string, kind: 'error' | 'success') => void;
  messages: Messages;
};

export function resolveCheckoutResumeExitHref(
  restaurantSlug: string,
  tableId: string,
): string {
  return waiterTableHref(restaurantSlug, tableId, { embeddedInDashboard: true });
}

export function isCheckoutResumeExitComplete(
  pathname: string,
  exitHref: string,
): boolean {
  return pathname === exitHref;
}

export function useCheckoutResumeOrdering(params: Params) {
  const {
    restaurantSlug,
    tableId,
    exitHref: exitHrefOverride,
    onMutated,
    showToast,
    messages,
  } = params;

  const router = useRouter();
  const pathname = usePathname();
  const exitHref =
    exitHrefOverride ?? resolveCheckoutResumeExitHref(restaurantSlug, tableId);

  const [phase, setPhase] = useState<CheckoutResumeOrderingPhase>('idle');
  const phaseRef = useRef<CheckoutResumeOrderingPhase>('idle');
  const inFlightRef = useRef(false);

  const setPhaseSafe = useCallback((next: CheckoutResumeOrderingPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const resumeOrdering = useCallback(async () => {
    if (inFlightRef.current || phaseRef.current !== 'idle') return;
    if (!restaurantSlug) {
      showToast(messages.failed, 'error');
      return;
    }

    inFlightRef.current = true;
    setPhaseSafe('mutating');
    let keepBusyAfterMutate = false;

    try {
      const outcome = await requestCheckoutResumeOrdering({
        slug: restaurantSlug,
        tableId,
      });
      if (!outcome.ok) {
        const message =
          outcome.error === 'whole_table_paid'
            ? messages.blockedWholeTable
            : messages.failed;
        showToast(message, 'error');
        return;
      }

      onMutated?.(tableId);
      showToast(messages.success, 'success');
      keepBusyAfterMutate = true;
      setPhaseSafe('exiting');
      router.replace(exitHref);
    } catch {
      showToast(messages.failed, 'error');
    } finally {
      if (!keepBusyAfterMutate) {
        setPhaseSafe('idle');
        inFlightRef.current = false;
      }
    }
  }, [
    exitHref,
    messages.blockedWholeTable,
    messages.failed,
    messages.success,
    onMutated,
    restaurantSlug,
    router,
    setPhaseSafe,
    showToast,
    tableId,
  ]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    if (!isCheckoutResumeExitComplete(pathname, exitHref)) return;
    setPhaseSafe('idle');
    inFlightRef.current = false;
  }, [exitHref, pathname, phase, setPhaseSafe]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    const timer = window.setTimeout(() => {
      if (phaseRef.current !== 'exiting') return;
      showToast(messages.redirectTimeout ?? messages.failed, 'error');
      setPhaseSafe('idle');
      inFlightRef.current = false;
    }, CHECKOUT_REDIRECT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [messages.failed, messages.redirectTimeout, phase, setPhaseSafe, showToast]);

  return {
    phase,
    isResumeBusy: phase !== 'idle',
    isResumeMutating: phase === 'mutating',
    resumeOrdering,
  };
}
