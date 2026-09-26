'use client';

import {
  BILL_SYNC_PAYMENT_METHODS,
  type BillSyncPaymentMethod,
} from '@/lib/bill-sync-payload';

export type CheckoutPaymentTenderLabels = {
  paymentMethod: string;
  cashReceived: string;
  changeDue: string;
  cashShort: string;
  multibancoAmount: string;
  cashRemainder: string;
  mixedNeedBothSides: string;
};

type Props = {
  due: number;
  payment: BillSyncPaymentMethod;
  tenderRaw: string;
  multibancoRaw: string;
  busy: boolean;
  paymentLabels: Record<BillSyncPaymentMethod, string>;
  labels: CheckoutPaymentTenderLabels;
  onPaymentChange: (method: BillSyncPaymentMethod) => void;
  onTenderRawChange: (raw: string) => void;
  onMultibancoRawChange: (raw: string) => void;
};

function parseMoney(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

/** Sole cash-tender default: due amount as editable decimal string. */
export function cashTenderDefaultRaw(dueAmount: number): string {
  return (Math.round(dueAmount * 100) / 100).toFixed(2);
}

/** Sole collect/invoice payment picker (CASH | MULTIBANCO | MIXED + mixed split). */
export function CheckoutPaymentTenderFields({
  due,
  payment,
  tenderRaw,
  multibancoRaw,
  busy,
  paymentLabels,
  labels,
  onPaymentChange,
  onTenderRawChange,
  onMultibancoRawChange,
}: Props) {
  const tender = parseMoney(tenderRaw);
  const cashShort = payment === 'CASH' && (tender == null || tender < due);
  const change = payment === 'CASH' && tender != null ? Math.round((tender - due) * 100) / 100 : 0;

  const mb = parseMoney(multibancoRaw);
  const mbClamped =
    mb == null ? null : Math.min(due, Math.max(0, Math.round(mb * 100) / 100));
  const cashRemainder =
    payment === 'MIXED' && mbClamped != null
      ? Math.round((due - mbClamped) * 100) / 100
      : due;
  const mixedBlocked =
    payment === 'MIXED' && (mbClamped == null || !(mbClamped > 0) || !(cashRemainder > 0));

  return (
    <div className="space-y-2">
      <p className="text-sm text-brand-text-muted">{labels.paymentMethod}</p>
      <div className="grid grid-cols-3 gap-2">
        {BILL_SYNC_PAYMENT_METHODS.map((opt) => {
          const selected = payment === opt;
          return (
            <button
              key={opt}
              type="button"
              disabled={busy}
              onClick={() => {
                onPaymentChange(opt);
                if (opt === 'CASH') {
                  onTenderRawChange(
                    tenderRaw.trim() === '' ? cashTenderDefaultRaw(due) : tenderRaw,
                  );
                }
                if (opt === 'MIXED') {
                  onMultibancoRawChange(cashTenderDefaultRaw(due));
                }
              }}
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

      {payment === 'CASH' ? (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="text-brand-text-muted">{labels.cashReceived}</span>
            <input
              value={tenderRaw}
              onChange={(e) => onTenderRawChange(e.target.value)}
              disabled={busy}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-brand-text tabular-nums"
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

      {payment === 'MIXED' ? (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="text-brand-text-muted">{labels.multibancoAmount}</span>
            <input
              value={multibancoRaw}
              onChange={(e) => onMultibancoRawChange(e.target.value)}
              disabled={busy}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-brand-text tabular-nums"
            />
          </label>
          <label className="block text-sm">
            <span className="text-brand-text-muted">{labels.cashRemainder}</span>
            <input
              value={cashRemainder.toFixed(2)}
              readOnly
              disabled
              className="mt-1 w-full rounded-lg border border-brand-border bg-brand-bg/60 px-3 py-2 text-brand-text tabular-nums opacity-80"
            />
          </label>
          {mixedBlocked ? (
            <p className="text-[12px] text-red-500">{labels.mixedNeedBothSides}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function checkoutPaymentTenderBlocked(input: {
  payment: BillSyncPaymentMethod;
  due: number;
  tenderRaw: string;
  multibancoRaw: string;
}): boolean {
  const due = Math.round(input.due * 100) / 100;
  if (input.payment === 'CASH') {
    const tender = parseMoney(input.tenderRaw);
    return tender == null || tender < due;
  }
  if (input.payment === 'MIXED') {
    const mb = parseMoney(input.multibancoRaw);
    if (mb == null || !(mb > 0) || mb > due) return true;
    const cash = Math.round((due - mb) * 100) / 100;
    return !(cash > 0);
  }
  return false;
}

export { parseMoney as parseCheckoutTenderMoney };
