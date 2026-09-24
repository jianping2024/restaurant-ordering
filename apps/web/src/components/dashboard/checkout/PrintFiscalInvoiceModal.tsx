'use client';

import { useEffect, useState } from 'react';
import {
  BILL_SYNC_PAYMENT_METHODS,
  billSyncDocumentTypeForPayment,
  type BillSyncPaymentMethod,
} from '@/lib/bill-sync-payload';

export type PrintFiscalInvoiceModalLabels = {
  title: string;
  nif: string;
  nifOptional: string;
  name: string;
  nameOptional: string;
  paymentMethod: string;
  documentTypeHint: string;
  confirm: string;
  cancel: string;
  operating: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  labels: PrintFiscalInvoiceModalLabels;
  paymentLabels: Record<BillSyncPaymentMethod, string>;
  /** Prefill from ledger tender when printing after collect. */
  initialPaymentMethod?: BillSyncPaymentMethod | null;
  onClose: () => void;
  onConfirm: (input: {
    paymentMethod: BillSyncPaymentMethod;
    customerNif: string;
    customerName: string;
  }) => void;
};

/** Sole checkout/history modal for fiscal invoice buyer + payment before enqueue. */
export function PrintFiscalInvoiceModal({
  open,
  busy,
  labels,
  paymentLabels,
  initialPaymentMethod = null,
  onClose,
  onConfirm,
}: Props) {
  const [nif, setNif] = useState('');
  const [name, setName] = useState('');
  const [payment, setPayment] = useState<BillSyncPaymentMethod>('CASH');

  useEffect(() => {
    if (!open) return;
    setPayment(initialPaymentMethod ?? 'CASH');
    setNif('');
    setName('');
  }, [open, initialPaymentMethod]);

  if (!open) return null;

  const docType = billSyncDocumentTypeForPayment(payment);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-fiscal-invoice-title"
        className="w-full max-w-md rounded-xl bg-brand-surface border border-brand-border shadow-lg p-4 space-y-3"
      >
        <h2 id="print-fiscal-invoice-title" className="text-base font-semibold text-brand-text">
          {labels.title}
        </h2>
        <label className="block text-sm">
          <span className="text-brand-text-muted">
            {labels.nif}{' '}
            <span className="text-xs">({labels.nifOptional})</span>
          </span>
          <input
            value={nif}
            onChange={(e) => setNif(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-brand-text font-mono tabular-nums"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          <span className="text-brand-text-muted">
            {labels.name}{' '}
            <span className="text-xs">({labels.nameOptional})</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-brand-text"
            autoComplete="organization"
          />
        </label>
        <label className="block text-sm">
          <span className="text-brand-text-muted">{labels.paymentMethod}</span>
          <select
            value={payment}
            onChange={(e) => setPayment(e.target.value as BillSyncPaymentMethod)}
            disabled={busy}
            className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-brand-text"
          >
            {BILL_SYNC_PAYMENT_METHODS.map((opt) => (
              <option key={opt} value={opt}>
                {paymentLabels[opt] ?? opt}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-brand-text-muted">
          {labels.documentTypeHint.replace('{type}', docType)}
        </p>
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
            onClick={() =>
              onConfirm({
                paymentMethod: payment,
                customerNif: nif.trim(),
                customerName: name.trim(),
              })
            }
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-gold text-white disabled:opacity-50"
          >
            {busy ? labels.operating : labels.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
