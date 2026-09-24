'use client';

import { useState } from 'react';
import {
  BILL_SYNC_PAYMENT_METHODS,
  type BillSyncPaymentMethod,
} from '@/lib/bill-sync-payload';

export type CollectPaymentModalLabels = {
  title: string;
  amount: string;
  paymentMethod: string;
  confirm: string;
  cancel: string;
  processing: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  amount: number;
  labels: CollectPaymentModalLabels;
  paymentLabels: Record<BillSyncPaymentMethod, string>;
  onClose: () => void;
  onConfirm: (paymentMethod: BillSyncPaymentMethod) => void;
};

/** Sole checkout modal for tender + confirm before confirm-payment. */
export function CollectPaymentModal({
  open,
  busy,
  amount,
  labels,
  paymentLabels,
  onClose,
  onConfirm,
}: Props) {
  const [payment, setPayment] = useState<BillSyncPaymentMethod>('CASH');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="collect-payment-title"
        className="w-full max-w-md rounded-xl bg-brand-surface border border-brand-border shadow-lg p-4 space-y-3"
      >
        <h2 id="collect-payment-title" className="text-base font-semibold text-brand-text">
          {labels.title}
        </h2>
        <p className="text-sm text-brand-text-muted">
          {labels.amount}{' '}
          <span className="text-brand-gold font-semibold tabular-nums text-base">
            €{amount.toFixed(2)}
          </span>
        </p>
        <fieldset className="space-y-2" disabled={busy}>
          <legend className="text-sm text-brand-text-muted mb-1">{labels.paymentMethod}</legend>
          <div className="grid grid-cols-2 gap-2">
            {BILL_SYNC_PAYMENT_METHODS.map((opt) => {
              const selected = payment === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPayment(opt)}
                  className={[
                    'text-sm font-semibold px-3 py-2.5 rounded-lg border transition-colors',
                    selected
                      ? 'border-brand-gold bg-brand-gold/15 text-brand-text'
                      : 'border-brand-border text-brand-text hover:bg-brand-border/30',
                  ].join(' ')}
                >
                  {paymentLabels[opt] ?? opt}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text disabled:opacity-50"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm(payment)}
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-gold text-white disabled:opacity-50"
          >
            {busy ? labels.processing : labels.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
