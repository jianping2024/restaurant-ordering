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
};

export function CollectedPaymentsLedger({ payments, lang, t }: Props) {
  if (payments.length === 0) return null;

  return (
    <div className="rounded-lg border border-brand-border/60 px-3 py-2.5">
      <p className="text-[12px] text-brand-text-muted mb-1.5">{t.collectedPaymentsTitle}</p>
      <div className="space-y-1">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between gap-3 text-[13px]"
          >
            <span className="text-brand-text-muted min-w-0 truncate">
              {localizeSplitPersonName(payment.person_name, lang)}
              <span className="mx-1.5 text-brand-border" aria-hidden>
                ·
              </span>
              <time
                className="tabular-nums"
                dateTime={payment.created_at}
                title={formatOrderDateTime(lang, payment.created_at)}
              >
                {formatCollectedPaymentTime(lang, payment.created_at)}
              </time>
            </span>
            <span className="text-brand-text tabular-nums shrink-0">
              €{payment.amount.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[12px] mt-1.5 pt-1.5 border-t border-brand-border/30">
        <span className="text-brand-text-muted">{t.collectedPaymentsTotal}</span>
        <span className="text-brand-text tabular-nums">
          €{totalCollectedAmount(payments).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
