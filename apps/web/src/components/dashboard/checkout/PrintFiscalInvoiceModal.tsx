'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalConfirmActions } from '@/components/ui/ModalConfirmActions';
import {
  CheckoutPaymentTenderFields,
  cashTenderDefaultRaw,
  checkoutPaymentTenderBlocked,
  parseCheckoutTenderMoney,
  type CheckoutPaymentTenderLabels,
} from '@/components/dashboard/checkout/CheckoutPaymentTenderFields';
import {
  billSyncDocumentTypeForPayment,
  resolveCollectPaymentTender,
  type BillSyncPaymentLine,
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
  documentTypeHint: string;
  confirm: string;
  cancel: string;
} & CheckoutPaymentTenderLabels;

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

export type PrintFiscalInvoiceConfirmInput = {
  paymentMethod: BillSyncPaymentMethod;
  payment_lines: BillSyncPaymentLine[];
  customerNif: string;
  customerName: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  /** Discounted gross for FS/FT threshold + mixed split. */
  amount: number;
  labels: PrintFiscalInvoiceModalLabels;
  paymentLabels: Record<BillSyncPaymentMethod, string>;
  /** Prefill from ledger tender when printing after collect. */
  initialPaymentMethod?: BillSyncPaymentMethod | null;
  onClose: () => void;
  onConfirm: (input: PrintFiscalInvoiceConfirmInput) => void;
};

/** Sole checkout/history modal for fiscal invoice buyer + same tender UI as collect. */
export function PrintFiscalInvoiceModal({
  open,
  busy,
  amount,
  labels,
  paymentLabels,
  initialPaymentMethod = null,
  onClose,
  onConfirm,
}: Props) {
  const [nif, setNif] = useState('');
  const [name, setName] = useState('');
  const [payment, setPayment] = useState<BillSyncPaymentMethod>('CASH');
  const [tenderRaw, setTenderRaw] = useState('');
  const [multibancoRaw, setMultibancoRaw] = useState('');

  const due = Math.round(amount * 100) / 100;

  useEffect(() => {
    if (!open) return;
    setPayment(initialPaymentMethod ?? 'CASH');
    setTenderRaw(cashTenderDefaultRaw(amount));
    setMultibancoRaw(cashTenderDefaultRaw(amount));
    setNif('');
    setName('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-edge reset
  }, [open, initialPaymentMethod]);

  const tenderBlocked = checkoutPaymentTenderBlocked({
    payment,
    due,
    tenderRaw,
    multibancoRaw,
  });
  const nifInvalid = nif.trim().length > 0 && !validatePortugueseNif(nif);

  const mbPreview = parseCheckoutTenderMoney(multibancoRaw);
  const resolvedPreview =
    payment === 'MIXED'
      ? resolveCollectPaymentTender({
          uiMethod: 'MIXED',
          dueAmount: due,
          multibancoAmount: mbPreview,
        })
      : resolveCollectPaymentTender({ uiMethod: payment, dueAmount: due });
  const previewMethod =
    resolvedPreview.ok ? resolvedPreview.paymentMethod : payment;
  const docType = billSyncDocumentTypeForPayment(previewMethod, due);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={labels.title}
      size="sm"
      dismissOnBackdrop={!busy}
    >
      <div className="space-y-4">
        <CheckoutPaymentTenderFields
          due={due}
          payment={payment}
          tenderRaw={tenderRaw}
          multibancoRaw={multibancoRaw}
          busy={busy}
          paymentLabels={paymentLabels}
          labels={labels}
          onPaymentChange={setPayment}
          onTenderRawChange={setTenderRaw}
          onMultibancoRawChange={setMultibancoRaw}
        />
        <FiscalBuyerFields
          nif={nif}
          name={name}
          disabled={busy}
          labels={labels}
          documentType={docType}
          onNifChange={setNif}
          onNameChange={setName}
        />
        <ModalConfirmActions
          cancelLabel={labels.cancel}
          confirmLabel={labels.confirm}
          onCancel={onClose}
          onConfirm={() => {
            if (tenderBlocked || nifInvalid) return;
            const mb = parseCheckoutTenderMoney(multibancoRaw);
            const resolved = resolveCollectPaymentTender({
              uiMethod: payment,
              dueAmount: due,
              multibancoAmount: payment === 'MIXED' ? mb : null,
            });
            if (!resolved.ok) return;
            onConfirm({
              paymentMethod: resolved.paymentMethod,
              payment_lines: resolved.payment_lines,
              customerNif: normalizePortugueseNif(nif),
              customerName: name.trim(),
            });
          }}
          busy={busy}
          confirmDisabled={tenderBlocked || nifInvalid}
        />
      </div>
    </Modal>
  );
}
