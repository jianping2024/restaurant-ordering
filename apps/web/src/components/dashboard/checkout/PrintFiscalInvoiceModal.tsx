'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  BILL_SYNC_PAYMENT_METHODS,
  billSyncDocumentTypeForPayment,
  type BillSyncPaymentMethod,
} from '@/lib/bill-sync-payload';
import {
  formatPortugueseNif,
  normalizePortugueseNif,
  validatePortugueseNif,
} from '@/lib/pt-nif';

export type PrintFiscalInvoiceModalLabels = {
  title: string;
  nif: string;
  nifOptional: string;
  /** Same copy as bill.nifInvalid — Portuguese NIF mod-11 failure. */
  nifInvalid: string;
  name: string;
  nameOptional: string;
  paymentMethod: string;
  documentTypeHint: string;
  confirm: string;
  cancel: string;
  operating: string;
};

export type FiscalBuyerFieldLabels = {
  nif: string;
  nifOptional: string;
  nifInvalid: string;
  name: string;
  nameOptional: string;
  documentTypeHint: string;
};

/** Sole NIF + customer name + document-type hint. Payment control stays with the caller. */
export function FiscalBuyerFields(props: {
  nif: string;
  name: string;
  disabled: boolean;
  labels: FiscalBuyerFieldLabels;
  documentType: string;
  onNifChange: (value: string) => void;
  onNameChange: (value: string) => void;
}) {
  const { nif, name, disabled, labels, documentType, onNifChange, onNameChange } = props;
  const nifInvalid = nif.trim().length > 0 && !validatePortugueseNif(nif);
  return (
    <>
      <label className="block text-sm">
        <span className="text-brand-text-muted">
          {labels.nif}{' '}
          <span className="text-xs">({labels.nifOptional})</span>
        </span>
        <input
          value={nif}
          onChange={(e) => onNifChange(formatPortugueseNif(e.target.value))}
          disabled={disabled}
          className={`mt-1 w-full rounded-lg border bg-brand-bg px-3 py-2 text-brand-text font-mono tabular-nums ${
            nifInvalid
              ? 'border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40'
              : 'border-brand-border'
          }`}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={nifInvalid}
        />
        {nifInvalid ? (
          <p className="mt-1.5 text-[12px] text-red-500">{labels.nifInvalid}</p>
        ) : null}
      </label>
      <label className="block text-sm">
        <span className="text-brand-text-muted">
          {labels.name}{' '}
          <span className="text-xs">({labels.nameOptional})</span>
        </span>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-brand-text"
          autoComplete="organization"
        />
      </label>
      <p className="text-xs text-brand-text-muted">
        {labels.documentTypeHint.replace('{type}', documentType)}
      </p>
    </>
  );
}

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

  const docType = billSyncDocumentTypeForPayment(payment);
  const nifInvalid = nif.trim().length > 0 && !validatePortugueseNif(nif);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      size="sm"
      dismissOnBackdrop={!busy}
    >
      <div className="space-y-4">
        <FiscalBuyerFields
          nif={nif}
          name={name}
          disabled={busy}
          labels={labels}
          documentType={docType}
          onNifChange={setNif}
          onNameChange={setName}
        />
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
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            loading={busy}
            disabled={busy || nifInvalid}
            onClick={() => {
              if (nifInvalid) return;
              onConfirm({
                paymentMethod: payment,
                customerNif: normalizePortugueseNif(nif),
                customerName: name.trim(),
              });
            }}
          >
            {busy ? labels.operating : labels.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
