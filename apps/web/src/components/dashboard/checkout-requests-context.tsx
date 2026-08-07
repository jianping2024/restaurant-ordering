'use client';

import { createContext, useContext } from 'react';
import type { ConfirmPaymentClientOutcome } from '@/lib/checkout-confirm-payment-outcome';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { BillSplit } from '@/types';

export type CheckoutRequestsContextValue = {
  requests: BillSplit[];
  pendingCount: number;
  reload: () => Promise<void>;
  updateRequests: (updater: (prev: BillSplit[]) => BillSplit[]) => void;
  upsertRequestFromSubmit: (row: BillSplit) => void;
  getCollectedForSession: (sessionId: string | null | undefined) => SessionCollectedPayment[];
  applyConfirmPaymentOutcome: (params: {
    billSplitId: string;
    sessionId: string | null | undefined;
    outcome: ConfirmPaymentClientOutcome;
  }) => void;
};

export const CheckoutRequestsContext = createContext<CheckoutRequestsContextValue | null>(null);

export function useCheckoutRequests(): CheckoutRequestsContextValue {
  const ctx = useContext(CheckoutRequestsContext);
  if (!ctx) {
    throw new Error('useCheckoutRequests must be used within CheckoutRequestsProvider');
  }
  return ctx;
}

/** Top bar badge — does not import the realtime-heavy provider module. */
export function useCheckoutRequestsPendingCount(): number {
  return useContext(CheckoutRequestsContext)?.pendingCount ?? 0;
}
