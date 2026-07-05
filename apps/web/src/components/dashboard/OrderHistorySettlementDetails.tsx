import { CollectedPaymentsLedger } from '@/components/dashboard/checkout/CollectedPaymentsLedger';
import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { UILanguage } from '@/lib/i18n';
import type { getMessages } from '@/lib/i18n/messages';

type CheckoutT = ReturnType<typeof getMessages>['checkout'];

type Props = {
  summary: CheckoutSettlementSummary;
  collectedPayments: SessionCollectedPayment[];
  lang: UILanguage;
  checkoutT: CheckoutT;
};

function SettlementRow({
  label,
  amount,
  highlight = false,
}: {
  label: string;
  amount: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-brand-text-muted">{label}</span>
      <span
        className={`tabular-nums font-medium ${
          highlight ? 'text-brand-gold font-semibold' : 'text-brand-text'
        }`}
      >
        €{amount.toFixed(2)}
      </span>
    </div>
  );
}

export function OrderHistorySettlementDetails({
  summary,
  collectedPayments,
  lang,
  checkoutT,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-2.5 space-y-2">
        <SettlementRow label={checkoutT.settlementConsumption} amount={summary.consumption} />
        <SettlementRow label={checkoutT.finalAmount} amount={summary.payable} />
        <SettlementRow label={checkoutT.settlementCollected} amount={summary.collected} />
        <SettlementRow label={checkoutT.settlementPending} amount={summary.pending} highlight />
        {summary.discountRate > 0 ? (
          <p className="pt-1 text-[13px] text-brand-text-muted border-t border-brand-gold/20">
            {checkoutT.settlementDiscount.replace('{n}', String(summary.discountRate))}
          </p>
        ) : null}
      </div>

      <CollectedPaymentsLedger payments={collectedPayments} lang={lang} t={checkoutT} />
    </div>
  );
}
