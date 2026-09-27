'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FiscalBuyerFields, type FiscalBuyerFieldLabels } from '@/components/dashboard/checkout/PrintFiscalInvoiceModal';
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
import { CHECKOUT_ACTION_AMOUNT_CLASS } from '@/lib/checkout-amount-type';
import { formatCheckoutCollectDiscountDetail } from '@/lib/checkout-split-math';
import { normalizePortugueseNif, validatePortugueseNif } from '@/lib/pt-nif';

export type CollectPaymentModalLabels = {
  title: string;
  amount: string;
  /** Template `折前 €{pre} · 折扣 {n}%` — omit line when no discount. */
  discountDetail?: string;
  confirm: string;
  cancel: string;
  processing: string;
} & CheckoutPaymentTenderLabels;

export type CollectPaymentConfirmInput = {
  paymentMethod: BillSyncPaymentMethod;
  payment_lines: BillSyncPaymentLine[];
  customerNif: string;
  customerName: string;
  cashTendered: number | null;
};

type Props = {
  open: boolean;
  busy: boolean;
  amount: number;
  /** Ticket pre-discount obligation — drives optional discount detail line. */
  preDiscountAmount?: number;
  discountRate?: number;
  /** Seed for optional fiscal buyer name (person being collected). */
  initialCustomerName?: string;
  labels: CollectPaymentModalLabels;
  paymentLabels: Record<BillSyncPaymentMethod, string>;
  fiscalLabels?: FiscalBuyerFieldLabels | null;
  onClose: () => void;
  onConfirm: (input: CollectPaymentConfirmInput) => void;
};

/** Sole checkout modal for tender, cash change, mixed split, and optional fiscal buyer fields. */
export function CollectPaymentModal({
  open,
  busy,
  amount,
  preDiscountAmount,
  discountRate = 0,
  initialCustomerName = '',
  labels,
  paymentLabels,
  fiscalLabels = null,
  onClose,
  onConfirm,
}: Props) {
  const [payment, setPayment] = useState<BillSyncPaymentMethod>('CASH');
  const [tenderRaw, setTenderRaw] = useState('');
  const [multibancoRaw, setMultibancoRaw] = useState('');
  const [nif, setNif] = useState('');
  const [name, setName] = useState('');

  const due = Math.round(amount * 100) / 100;
  const discountDetail =
    labels.discountDetail && preDiscountAmount != null
      ? formatCheckoutCollectDiscountDetail(
          labels.discountDetail,
          preDiscountAmount,
          discountRate,
        )
      : null;

  useEffect(() => {
    if (!open) return;
    setPayment('CASH');
    setTenderRaw(cashTenderDefaultRaw(amount));
    setMultibancoRaw(cashTenderDefaultRaw(amount));
    setNif('');
    setName(initialCustomerName.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-edge reset
  }, [open]);

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
        <p className="text-sm text-brand-text-muted">
          {labels.amount}{' '}
          <span className={CHECKOUT_ACTION_AMOUNT_CLASS}>
            €{due.toFixed(2)}
          </span>
        </p>
        {discountDetail ? (
          <p className="-mt-2 text-[13px] text-brand-text-muted tabular-nums">{discountDetail}</p>
        ) : null}
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
        {fiscalLabels ? (
          <FiscalBuyerFields
            nif={nif}
            name={name}
            disabled={busy}
            labels={fiscalLabels}
            documentType={docType}
            onNifChange={setNif}
            onNameChange={setName}
          />
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            {labels.cancel}
          </Button>
          <Button
            type="button"
            variant="gold"
            size="sm"
            loading={busy}
            disabled={busy || tenderBlocked || nifInvalid}
            onClick={() => {
              if (tenderBlocked || nifInvalid) return;
              const mb = parseCheckoutTenderMoney(multibancoRaw);
              const resolved = resolveCollectPaymentTender({
                uiMethod: payment,
                dueAmount: due,
                multibancoAmount: payment === 'MIXED' ? mb : null,
              });
              if (!resolved.ok) return;
              const tender = parseCheckoutTenderMoney(tenderRaw);
              onConfirm({
                paymentMethod: resolved.paymentMethod,
                payment_lines: resolved.payment_lines,
                customerNif: normalizePortugueseNif(nif),
                customerName: name.trim(),
                cashTendered:
                  resolved.paymentMethod === 'CASH' ? tender : null,
              });
            }}
          >
            {busy ? labels.processing : labels.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
