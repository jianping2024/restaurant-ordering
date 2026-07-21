import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import type { OrderHistorySettlementVariant } from '@/lib/order-history/build-detail-presentation';
import type { getMessages } from '@/lib/i18n/messages';

type CheckoutT = ReturnType<typeof getMessages>['checkout'];
type OrderHistoryT = ReturnType<typeof getMessages>['orderHistory'];

type Props = {
  variant: OrderHistorySettlementVariant;
  summary: CheckoutSettlementSummary;
  checkoutT: CheckoutT;
  orderHistoryT: OrderHistoryT;
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
  variant,
  summary,
  checkoutT,
  orderHistoryT,
}: Props) {
  return (
    <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-2.5 space-y-2">
      {variant === 'settled_compact' ? (
        <SettlementRow
          label={orderHistoryT.settlementCollectedCompact}
          amount={summary.collected}
          highlight
        />
      ) : (
        <>
          <SettlementRow label={checkoutT.settlementConsumption} amount={summary.consumption} />
          <SettlementRow label={checkoutT.finalAmount} amount={summary.payable} />
          <SettlementRow label={checkoutT.settlementCollected} amount={summary.collected} />
          <SettlementRow
            label={checkoutT.settlementPending}
            amount={summary.pending}
            highlight={variant === 'active_breakdown'}
          />
        </>
      )}
      {summary.discountRate > 0 ? (
        <p className="pt-1 text-[13px] text-brand-text-muted border-t border-brand-gold/20">
          {checkoutT.settlementDiscount.replace('{n}', String(summary.discountRate))}
        </p>
      ) : null}
    </div>
  );
}
