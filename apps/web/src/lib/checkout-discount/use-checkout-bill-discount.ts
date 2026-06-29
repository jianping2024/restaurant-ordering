'use client';

import { useCallback, useRef, useState } from 'react';
import { clampCheckoutDiscountRate } from '@/lib/checkout-split-math';

export type PendingDiscountSetup = {
  requestId: string;
  rate: number;
  previousRate: number;
};

/** Draft + dialog state for bill-level checkout discount setup (persisted via apply-discount API). */
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

  const handleRateChange = useCallback((requestId: string, next: number) => {
    setDraftRateById((prev) => ({
      ...prev,
      [requestId]: clampCheckoutDiscountRate(next),
    }));
  }, []);

  const handleRateFocus = useCallback((requestId: string, serverRate: number) => {
    rateBeforeEditRef.current[requestId] = getDisplayRate(requestId, serverRate);
  }, [getDisplayRate]);

  const beginSetupIfNeeded = useCallback(
    (requestId: string, rate: number, serverRate: number, serverReason: string | null | undefined) => {
      const previousRate = rateBeforeEditRef.current[requestId] ?? clampCheckoutDiscountRate(serverRate);
      if (rate <= 0) {
        return { needsReason: false as const, rate, previousRate };
      }
      if (serverReason?.trim()) {
        return { needsReason: false as const, rate, previousRate };
      }
      setPendingSetup({ requestId, rate, previousRate });
      return { needsReason: true as const, rate, previousRate };
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
    handleRateChange,
    handleRateFocus,
    beginSetupIfNeeded,
    cancelSetup,
    finishSetup,
    setApplying,
  };
}
