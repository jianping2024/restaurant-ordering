import { localizeSplitPersonName } from '@/lib/split-person-label';
import { totalCollectedAmount, type SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { UILanguage } from '@/lib/i18n';

type Labels = {
  collectedPaymentsTitle: string;
  collectedPaymentsTotal: string;
  printReceipt: string;
  printReceiptOperating: string;
  printReceiptCooldown: string;
};

type Props = {
  payments: SessionCollectedPayment[];
  lang: UILanguage;
  t: Labels;
  /** When false, omits card border (checkout detail embed). Default true. */
  bordered?: boolean;
  className?: string;
  /** Multi-person split only — shows per-row print receipt action. */
  showPrintReceiptActions?: boolean;
  onPrintReceipt?: (payment: SessionCollectedPayment) => void;
  isPrintReceiptBusy?: (payment: SessionCollectedPayment) => boolean;
  printReceiptCooldownSeconds?: (payment: SessionCollectedPayment) => number;
  isPrintReceiptOnCooldown?: (payment: SessionCollectedPayment) => boolean;
};

export function CollectedPaymentsLedger({
  payments,
  lang,
  t,
  bordered = true,
  className = '',
  showPrintReceiptActions = false,
  onPrintReceipt,
  isPrintReceiptBusy,
  printReceiptCooldownSeconds,
  isPrintReceiptOnCooldown,
}: Props) {
  if (payments.length === 0) return null;

  const rootClass = [
    bordered ? 'rounded-lg border border-brand-border/60 px-3 py-2.5' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass}>
      <p className="text-[12px] text-brand-text-muted mb-1.5">{t.collectedPaymentsTitle}</p>
      <div className="space-y-2">
        {payments.map((payment) => {
          const busy = isPrintReceiptBusy?.(payment) ?? false;
          const onCooldown = isPrintReceiptOnCooldown?.(payment) ?? false;
          const cooldownSeconds = printReceiptCooldownSeconds?.(payment) ?? 0;
          const printLabel = busy
            ? t.printReceiptOperating
            : onCooldown
              ? t.printReceiptCooldown.replace('{n}', String(cooldownSeconds))
              : t.printReceipt;

          return (
            <div
              key={payment.id}
              className="flex items-center justify-between gap-3 text-[13px]"
            >
              <span className="text-brand-text font-medium min-w-0 truncate">
                {localizeSplitPersonName(payment.person_name, lang)}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-brand-text font-medium tabular-nums">
                  €{payment.amount.toFixed(2)}
                </span>
                {showPrintReceiptActions &&
                onPrintReceipt &&
                payment.person_index != null ? (
                  <button
                    type="button"
                    onClick={() => onPrintReceipt(payment)}
                    disabled={busy || onCooldown}
                    className="text-[12px] font-semibold px-2.5 py-1 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {printLabel}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[12px] mt-1.5 pt-1.5 border-t border-brand-border/30">
        <span className="text-brand-text-muted">{t.collectedPaymentsTotal}</span>
        <span className="text-brand-text tabular-nums font-medium">
          €{totalCollectedAmount(payments).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
