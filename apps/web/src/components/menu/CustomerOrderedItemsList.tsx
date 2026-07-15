import type { Language, Order } from '@/types';
import { UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import { formatOrderItemListLabel } from '@/lib/order-list-display';
import { normalizeOrderItemStatus } from '@/lib/order-status';

type Props = {
  orders: Order[];
  lang: Language;
  emptyLabel: string;
  submittedHint?: string;
  loading?: boolean;
};

export function CustomerOrderedItemsList({
  orders,
  lang,
  emptyLabel,
  submittedHint,
  loading = false,
}: Props) {
  const locale = UI_LOCALE_BY_LANG[lang];

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse" aria-hidden="true">
        <div className="h-4 w-2/3 rounded bg-brand-border/40" />
        <div className="h-14 rounded-xl bg-brand-border/30" />
      </div>
    );
  }

  if (orders.length === 0) {
    return <p className="text-brand-text-muted text-sm">{emptyLabel}</p>;
  }

  return (
    <>
      {submittedHint ? (
        <p className="text-brand-text-muted text-[12px] mb-3">{submittedHint}</p>
      ) : null}
      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="border border-brand-border rounded-xl p-3">
            <div className="mb-2">
              <span className="text-[13px] text-brand-text-muted">
                {new Date(order.created_at).toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="space-y-1">
              {order.items.map((item, idx) => {
                if (normalizeOrderItemStatus(item, order.status) === 'voided') return null;
                return (
                  <p key={`${order.id}-${idx}`} className="text-sm text-brand-text">
                    {formatOrderItemListLabel(item, { headcountStyle: 'receipt' })}
                  </p>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
