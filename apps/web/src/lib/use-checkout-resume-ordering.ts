'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CHECKOUT_REDIRECT_TIMEOUT_MS } from '@/lib/checkout-request-submit';
import { messageForCheckoutErrorOverrides } from '@/lib/checkout-request-error-message';
import { logCheckoutResumeFailure } from '@/lib/checkout-resume-failure-log';
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
  /**
   * Sole resume prepare before RPC ({@link prepareStaffCheckoutResumeOrdering}):
   * drop empty unpaid by-item tickets, then block unpaid default names.
   * Return false to abort (toast already shown).
   */
  beforeResume?: () => Promise<boolean>;
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
    beforeResume,
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
      logCheckoutResumeFailure({
        stage: 'client',
        error: 'missing_slug',
        table_id: tableId,
      });
      showToast(messages.failed, 'error');
      return;
    }

    inFlightRef.current = true;
    setPhaseSafe('mutating');
    let keepBusyAfterMutate = false;

    try {
      if (beforeResume) {
        const flushed = await beforeResume();
        // Prepare gate logs its own failure reason; do not double-log here.
        if (!flushed) return;
      }
      const outcome = await requestCheckoutResumeOrdering({
        slug: restaurantSlug,
        tableId,
      });
      if (!outcome.ok) {
        logCheckoutResumeFailure({
          stage: 'client',
          error: outcome.error,
          slug: restaurantSlug,
          table_id: tableId,
        });
        const message = messageForCheckoutErrorOverrides(
          outcome.error,
          { whole_table_paid: messages.blockedWholeTable },
          messages.failed,
        );
        showToast(message, 'error');
        return;
      }

      onMutated?.(tableId);
      showToast(messages.success, 'success');
      keepBusyAfterMutate = true;
      setPhaseSafe('exiting');
      router.replace(exitHref);
    } catch {
      logCheckoutResumeFailure({
        stage: 'client',
        error: 'client_exception',
        slug: restaurantSlug,
        table_id: tableId,
      });
      showToast(messages.failed, 'error');
    } finally {
      if (!keepBusyAfterMutate) {
        setPhaseSafe('idle');
        inFlightRef.current = false;
      }
    }
  }, [
    beforeResume,
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
      logCheckoutResumeFailure({
        stage: 'client',
        error: 'redirect_timeout',
        slug: restaurantSlug,
        table_id: tableId,
      });
      showToast(messages.redirectTimeout ?? messages.failed, 'error');
      setPhaseSafe('idle');
      inFlightRef.current = false;
    }, CHECKOUT_REDIRECT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [
    messages.failed,
    messages.redirectTimeout,
    phase,
    restaurantSlug,
    setPhaseSafe,
    showToast,
    tableId,
  ]);

  return {
    phase,
    isResumeBusy: phase !== 'idle',
    isResumeMutating: phase === 'mutating',
    resumeOrdering,
  };
}
