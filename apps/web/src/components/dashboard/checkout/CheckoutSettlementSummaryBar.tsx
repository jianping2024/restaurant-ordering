import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';

type Labels = {
  settlementConsumption: string;
  finalAmount: string;
  settlementCollected: string;
  settlementPending: string;
  settlementDiscount: string;
};

type Props = {
  summary: CheckoutSettlementSummary;
  showDiscount?: boolean;
  t: Labels;
};

export function CheckoutSettlementSummaryBar({ summary, showDiscount = true, t }: Props) {
  return (
    <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-2.5">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="text-brand-text-muted">
          {t.settlementConsumption}{' '}
          <span className="text-brand-text tabular-nums font-medium">
            €{summary.consumption.toFixed(2)}
          </span>
        </span>
        <span className="text-brand-text-muted">
          {t.finalAmount}{' '}
          <span className="text-brand-text tabular-nums font-medium">
            €{summary.payable.toFixed(2)}
          </span>
        </span>
        {summary.collected > 0 ? (
          <span className="text-brand-text-muted">
            {t.settlementCollected}{' '}
            <span className="text-brand-text tabular-nums font-medium">
              €{summary.collected.toFixed(2)}
            </span>
          </span>
        ) : null}
        <span className="text-brand-text-muted">
          {t.settlementPending}{' '}
          <span className="text-brand-gold font-semibold tabular-nums">
            €{summary.pending.toFixed(2)}
          </span>
        </span>
      </div>
      {showDiscount && summary.discountRate > 0 ? (
        <p className="mt-2 text-[13px] text-brand-text-muted">
          {t.settlementDiscount.replace('{n}', String(summary.discountRate))}
        </p>
      ) : null}
    </div>
  );
}
