'use client';

import { useCallback, useRef, useState } from 'react';
import { clampCheckoutDiscountRate } from '@/lib/checkout-split-math';

export type CheckoutBillDiscountReason = {
  reason: string;
  detail?: string;
};

export function isCheckoutDiscountReasonError(error: string): boolean {
  return (
    error === 'reason_required' ||
    error === 'invalid_reason' ||
    error === 'reason_detail_required'
  );
}

/** Client state for bill-level checkout discount (rate + reason), separate from per-person payment. */
export function useCheckoutBillDiscount() {
  const [rateById, setRateById] = useState<Record<string, number>>({});
  const [reasonById, setReasonById] = useState<Record<string, CheckoutBillDiscountReason>>({});
  const [pendingSetup, setPendingSetup] = useState<{
    requestId: string;
    previousRate: number;
  } | null>(null);
  const rateBeforeEditRef = useRef<Record<string, number>>({});

  const getRate = useCallback(
    (requestId: string) => clampCheckoutDiscountRate(rateById[requestId] || 0),
    [rateById],
  );

  const getReason = useCallback(
    (requestId: string) => reasonById[requestId],
    [reasonById],
  );

  const isSetupComplete = useCallback(
    (requestId: string) => {
      const rate = clampCheckoutDiscountRate(rateById[requestId] || 0);
      return rate === 0 || !!reasonById[requestId];
    },
    [rateById, reasonById],
  );

  const clearReason = useCallback((requestId: string) => {
    setReasonById((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  }, []);

  const handleRateChange = useCallback(
    (requestId: string, next: number) => {
      const clamped = clampCheckoutDiscountRate(next);
      if (clamped === 0) {
        setRateById((prev) => ({ ...prev, [requestId]: 0 }));
        clearReason(requestId);
        return;
      }
      setRateById((prev) => ({ ...prev, [requestId]: clamped }));
    },
    [clearReason],
  );

  const handleRateFocus = useCallback(
    (requestId: string) => {
      rateBeforeEditRef.current[requestId] = getRate(requestId);
    },
    [getRate],
  );

  const handleRateBlur = useCallback(
    (requestId: string) => {
      const rate = getRate(requestId);
      if (rate <= 0 || getReason(requestId)) return;
      setPendingSetup({
        requestId,
        previousRate: rateBeforeEditRef.current[requestId] ?? 0,
      });
    },
    [getRate, getReason],
  );

  const cancelSetup = useCallback(() => {
    if (pendingSetup) {
      const { requestId, previousRate } = pendingSetup;
      setRateById((prev) => ({ ...prev, [requestId]: previousRate }));
      if (previousRate === 0) {
        clearReason(requestId);
      }
    }
    setPendingSetup(null);
  }, [pendingSetup, clearReason]);

  const confirmSetup = useCallback((requestId: string, reason: string, detail: string) => {
    setReasonById((prev) => ({
      ...prev,
      [requestId]: { reason, detail: detail || undefined },
    }));
    setPendingSetup(null);
  }, []);

  const paymentPayload = useCallback(
    (requestId: string) => {
      const rate = getRate(requestId);
      const entry = getReason(requestId);
      return {
        discountRate: rate,
        ...(rate > 0 && entry
          ? { discountReason: entry.reason, discountReasonDetail: entry.detail }
          : {}),
      };
    },
    [getRate, getReason],
  );

  return {
    getRate,
    getReason,
    isSetupComplete,
    pendingSetup,
    handleRateChange,
    handleRateFocus,
    handleRateBlur,
    cancelSetup,
    confirmSetup,
    paymentPayload,
  };
}
