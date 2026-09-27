'use client';

import { useCallback, useRef, useState } from 'react';
import { clampCheckoutDiscountRate } from '@/lib/checkout-split-math';
import {
  resolveCheckoutDiscountCommit,
  type CheckoutDiscountCommitDecision,
} from '@/lib/checkout-discount/resolve-checkout-discount-commit';

export type PendingDiscountSetup = {
  requestId: string;
  rate: number;
  previousRate: number;
};

/** Draft + dialog state for bill-level checkout discount (persisted via apply-discount API). */
export function useCheckoutBillDiscount() {
  const [draftRateById, setDraftRateById] = useState<Record<string, number>>({});
  const [pendingSetup, setPendingSetup] = useState<PendingDiscountSetup | null>(null);
  const [applyingRequestId, setApplyingRequestId] = useState<string | null>(null);
  const rateBeforeEditRef = useRef<Record<string, number>>({});

  const getDisplayRate = useCallback(
    (requestId: string, serverRate: number) =>
      draftRateById[requestId] ?? clampCheckoutDiscountRate(serverRate),
    [draftRateById],
  );

  const clearDraft = useCallback((requestId: string) => {
    setDraftRateById((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  }, []);

  const handleRateFocus = useCallback((requestId: string, serverRate: number) => {
    rateBeforeEditRef.current[requestId] = getDisplayRate(requestId, serverRate);
  }, [getDisplayRate]);

  /**
   * Sole commit from discount IntegerInput (fires on blur parse).
   * Writes local draft, then decides reason dialog / persist / clear — with the
   * committed rate, not a stale getDisplayRate re-read.
   */
  const commitRate = useCallback(
    (
      requestId: string,
      rate: number,
      serverRate: number,
      serverReason: string | null | undefined,
    ): CheckoutDiscountCommitDecision => {
      const clamped = clampCheckoutDiscountRate(rate);
      setDraftRateById((prev) => ({ ...prev, [requestId]: clamped }));
      const previousRate =
        rateBeforeEditRef.current[requestId] ?? clampCheckoutDiscountRate(serverRate);
      const decision = resolveCheckoutDiscountCommit({
        rate: clamped,
        serverRate,
        serverReason,
        previousRate,
      });
      if (decision.kind === 'needs_reason') {
        setPendingSetup({
          requestId,
          rate: decision.rate,
          previousRate: decision.previousRate,
        });
      }
      return decision;
    },
    [],
  );

  const cancelSetup = useCallback(() => {
    if (pendingSetup) {
      const { requestId, previousRate } = pendingSetup;
      setDraftRateById((prev) => ({ ...prev, [requestId]: previousRate }));
    }
    setPendingSetup(null);
  }, [pendingSetup]);

  const finishSetup = useCallback((requestId: string) => {
    clearDraft(requestId);
    setPendingSetup(null);
  }, [clearDraft]);

  const setApplying = useCallback((requestId: string | null) => {
    setApplyingRequestId(requestId);
  }, []);

  return {
    getDisplayRate,
    pendingSetup,
    applyingRequestId,
    handleRateFocus,
    commitRate,
    cancelSetup,
    finishSetup,
    setApplying,
  };
}
