'use client';

import { useMemo } from 'react';
import { CheckoutPersonShareExpandable } from '@/components/dashboard/checkout/CheckoutPersonShareExpandable';
import { CheckoutTableItemsSection } from '@/components/dashboard/checkout/CheckoutTableItemsSection';
import { CollectedPaymentsLedger } from '@/components/dashboard/checkout/CollectedPaymentsLedger';
import { OrderHistorySettlementDetails } from '@/components/dashboard/OrderHistorySettlementDetails';
import { buildOrderHistoryBillDetailView } from '@/lib/order-history/build-bill-detail-view';
import { formatForcedUnpaidCloseAnnotation } from '@/lib/order-history/resolve-close-annotation-label';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import { localizeSplitPersonName } from '@/lib/split-person-label';

type Props = {
  entry: OrderHistoryEntry;
  itemCodeByMenuId: Record<string, string>;
  lang: UILanguage;
};

export function OrderHistoryBillDetailPanel({ entry, itemCodeByMenuId, lang }: Props) {
  const checkoutT = getMessages(lang).checkout;

  const detail = useMemo(
    () => buildOrderHistoryBillDetailView(entry, itemCodeByMenuId, lang),
    [entry, itemCodeByMenuId, lang],
  );

  const forcedClose = formatForcedUnpaidCloseAnnotation(lang, entry.closeAnnotation);

  const personShareLabels = {
    expand: checkoutT.personShareItemsExpand,
    collapse: checkoutT.personShareItemsCollapse,
    empty: checkoutT.personShareItemsEmpty,
  };

  const { settlement } = entry;

  return (
    <div className="space-y-4">
      {forcedClose ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-brand-text">
          <p>{forcedClose.summary}</p>
          {forcedClose.detail ? (
            <p className="mt-1 text-[13px] text-brand-text-muted">{forcedClose.detail}</p>
          ) : null}
        </div>
      ) : null}

      {detail.splitModeLabel ? (
        <span className="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-brand-border/50 text-brand-text-muted">
          {detail.splitModeLabel}
        </span>
      ) : null}

      {settlement.showFinancialDetails && settlement.summary ? (
        <OrderHistorySettlementDetails summary={settlement.summary} checkoutT={checkoutT} />
      ) : null}

      {detail.showSplitSection ? (
        <div className="rounded-lg border border-brand-border/60 bg-brand-card/50 p-3">
          <p className="text-[13px] font-medium text-brand-text mb-2">{checkoutT.splitResult}</p>
          <div className="space-y-2">
            {detail.personRows.map((row) => (
              <CheckoutPersonShareExpandable
                key={`${entry.sessionId}-${row.index}`}
                canExpand={detail.canExpandPersonDishes}
                shareLines={row.shareLines}
                labels={personShareLabels}
                identity={
                  <span className="text-brand-text font-medium">
                    {localizeSplitPersonName(row.name, lang)}
                  </span>
                }
                trailing={
                  <span className="text-brand-gold font-semibold tabular-nums">
                    €{row.obligationAmount.toFixed(2)}
                  </span>
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {settlement.collectedPayments.length > 0 ? (
        <CollectedPaymentsLedger
          payments={settlement.collectedPayments}
          lang={lang}
          t={checkoutT}
          bordered={false}
          className="px-1"
          canExpandPersonDishes={detail.canExpandPersonDishes}
          shareLinesByPersonIndex={
            new Map(detail.personRows.map((row) => [row.index, row.shareLines]))
          }
        />
      ) : null}

      <CheckoutTableItemsSection
        lines={detail.tableLines}
        total={detail.tableLinesTotal}
        labels={{
          orderItemsCount: checkoutT.orderItemsCount,
          orderItemsEmpty: checkoutT.orderItemsEmpty,
          orderItemsTotal: checkoutT.orderItemsTotal,
        }}
      />
    </div>
  );
}
