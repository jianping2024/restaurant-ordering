'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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

  useEffect(() => {
    if (!open) return;
    setPayment('CASH');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      size="sm"
      dismissOnBackdrop={!busy}
    >
      <div className="space-y-4">
        <p className="text-sm text-brand-text-muted">
          {labels.amount}{' '}
          <span className="text-brand-gold font-semibold tabular-nums text-base">
            €{amount.toFixed(2)}
          </span>
        </p>
        <div className="space-y-2">
          <p className="text-sm text-brand-text-muted">{labels.paymentMethod}</p>
          <div className="grid grid-cols-2 gap-2">
            {BILL_SYNC_PAYMENT_METHODS.map((opt) => {
              const selected = payment === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={busy}
                  onClick={() => setPayment(opt)}
                  className={[
                    'text-sm font-semibold px-3 py-2.5 rounded-lg border transition-colors disabled:opacity-50',
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
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            loading={busy}
            disabled={busy}
            onClick={() => onConfirm(payment)}
          >
            {busy ? labels.processing : labels.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
