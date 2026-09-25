'use client';

import { createContext, useContext } from 'react';
import type { BillSplit } from '@/types';
import type { CheckoutPrintAsk } from '@/components/dashboard/checkout/CheckoutPrintChoiceDialog';
import type { ConfirmPaymentClientOutcome } from '@/lib/checkout-confirm-payment-outcome';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';

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
    /** When set, open the sole post-payment print question in the same update as the ledger. */
    printAsk?: CheckoutPrintAsk | null;
    /** Re-insert if Realtime already dropped the paid row before this client update. */
    heldRow?: BillSplit;
  }) => void;
  /** Sole post-payment print question — lives on the provider so queue/detail remounts cannot drop it. */
  printAsk: CheckoutPrintAsk | null;
  setPrintAsk: (ask: CheckoutPrintAsk | null) => void;
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
