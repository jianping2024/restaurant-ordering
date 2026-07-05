import {
  formatCollectedPaymentTime,
  formatOrderDateTime,
} from '@/lib/format-dashboard-date';
import { localizeSplitPersonName } from '@/lib/split-person-label';
import { totalCollectedAmount, type SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { UILanguage } from '@/lib/i18n';

type Labels = {
  collectedPaymentsTitle: string;
  collectedPaymentsTotal: string;
};

type Props = {
  payments: SessionCollectedPayment[];
  lang: UILanguage;
  t: Labels;
  /** When false, omits card border (checkout detail embed). Default true. */
  bordered?: boolean;
  className?: string;
};

export function CollectedPaymentsLedger({
  payments,
  lang,
  t,
  bordered = true,
  className = '',
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
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-start justify-between gap-3 text-[13px]"
          >
            <div className="min-w-0">
              <span className="text-brand-text font-medium">
                {localizeSplitPersonName(payment.person_name, lang)}
              </span>
              <p className="text-[11px] text-brand-text-muted tabular-nums mt-0.5">
                <time
                  dateTime={payment.created_at}
                  title={formatOrderDateTime(lang, payment.created_at)}
                >
                  {formatCollectedPaymentTime(lang, payment.created_at)}
                </time>
              </p>
            </div>
            <span className="text-brand-text font-medium tabular-nums shrink-0">
              €{payment.amount.toFixed(2)}
            </span>
          </div>
        ))}
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
