'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FiscalBuyerFields, type FiscalBuyerFieldLabels } from '@/components/dashboard/checkout/PrintFiscalInvoiceModal';
import {
  BILL_SYNC_PAYMENT_METHODS,
  billSyncDocumentTypeForPayment,
  type BillSyncPaymentMethod,
} from '@/lib/bill-sync-payload';
import { normalizePortugueseNif, validatePortugueseNif } from '@/lib/pt-nif';

export type CollectPaymentModalLabels = {
  title: string;
  amount: string;
  paymentMethod: string;
  confirm: string;
  cancel: string;
  processing: string;
  cashReceived: string;
  changeDue: string;
  cashShort: string;
};

export type CollectPaymentConfirmInput = {
  paymentMethod: BillSyncPaymentMethod;
  customerNif: string;
  customerName: string;
  cashTendered: number | null;
};

type Props = {
  open: boolean;
  busy: boolean;
  amount: number;
  labels: CollectPaymentModalLabels;
  paymentLabels: Record<BillSyncPaymentMethod, string>;
  /** Present only when this store can issue a fiscal invoice. */
  fiscalLabels?: FiscalBuyerFieldLabels | null;
  onClose: () => void;
  onConfirm: (input: CollectPaymentConfirmInput) => void;
};

function parseTender(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

/** Sole checkout modal for tender, cash change, and optional fiscal buyer fields. */
export function CollectPaymentModal({
  open,
  busy,
  amount,
  labels,
  paymentLabels,
  fiscalLabels = null,
  onClose,
  onConfirm,
}: Props) {
  const [payment, setPayment] = useState<BillSyncPaymentMethod>('CASH');
  const [tenderRaw, setTenderRaw] = useState('');
  const [nif, setNif] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    setPayment('CASH');
    setTenderRaw('');
    setNif('');
    setName('');
  }, [open]);

  const due = Math.round(amount * 100) / 100;
  const tender = parseTender(tenderRaw);
  const cashShort = payment === 'CASH' && (tender == null || tender < due);
  const change = payment === 'CASH' && tender != null ? Math.round((tender - due) * 100) / 100 : 0;
  const nifInvalid = nif.trim().length > 0 && !validatePortugueseNif(nif);
  const docType = billSyncDocumentTypeForPayment(payment);

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
            €{due.toFixed(2)}
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
        {payment === 'CASH' ? (
          <div className="space-y-2">
            <label className="block text-sm">
              <span className="text-brand-text-muted">{labels.cashReceived}</span>
              <input
                value={tenderRaw}
                onChange={(e) => setTenderRaw(e.target.value)}
                disabled={busy}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-brand-text tabular-nums"
                placeholder={due.toFixed(2)}
              />
            </label>
            {cashShort ? (
              <p className="text-[12px] text-red-500">{labels.cashShort}</p>
            ) : (
              <p className="text-sm text-brand-text-muted">
                {labels.changeDue}{' '}
                <span className="text-brand-text font-semibold tabular-nums">
                  €{Math.max(0, change).toFixed(2)}
                </span>
              </p>
            )}
          </div>
        ) : null}
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
            disabled={busy || cashShort || nifInvalid}
            onClick={() => {
              if (cashShort || nifInvalid) return;
              onConfirm({
                paymentMethod: payment,
                customerNif: normalizePortugueseNif(nif),
                customerName: name.trim(),
                cashTendered: payment === 'CASH' ? tender : null,
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
