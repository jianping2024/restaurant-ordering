'use client';

import { useMemo, useState } from 'react';
import { CheckoutPersonShareExpandable } from '@/components/dashboard/checkout/CheckoutPersonShareExpandable';
import { CollectedPaymentsLedger } from '@/components/dashboard/checkout/CollectedPaymentsLedger';
import { OrderHistorySettlementDetails } from '@/components/dashboard/OrderHistorySettlementDetails';
import { buildOrderHistoryBillDetailView } from '@/lib/order-history/build-bill-detail-view';
import {
  resolveForcedUnpaidCloseDetail,
  resolveForcedUnpaidCloseSummary,
} from '@/lib/order-history/resolve-close-annotation-label';
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
  const [orderItemsOpen, setOrderItemsOpen] = useState(false);

  const detail = useMemo(
    () => buildOrderHistoryBillDetailView(entry, itemCodeByMenuId, lang),
    [entry, itemCodeByMenuId, lang],
  );

  const forcedCloseSummary = resolveForcedUnpaidCloseSummary(lang, entry.closeAnnotation);
  const forcedCloseDetail = resolveForcedUnpaidCloseDetail(entry.closeAnnotation);

  const personShareLabels = {
    expand: checkoutT.personShareItemsExpand,
    collapse: checkoutT.personShareItemsCollapse,
    empty: checkoutT.personShareItemsEmpty,
  };

  const { settlement } = entry;

  return (
    <div className="space-y-4">
      {forcedCloseSummary ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-brand-text">
          <p>{forcedCloseSummary}</p>
          {forcedCloseDetail ? (
            <p className="mt-1 text-[13px] text-brand-text-muted">{forcedCloseDetail}</p>
          ) : null}
        </div>
      ) : null}

      {detail.splitModeLabel ? (
        <span className="inline-flex text-[11px] px-2 py-0.5 rounded-full bg-brand-border/50 text-brand-text-muted">
          {detail.splitModeLabel}
        </span>
      ) : null}

      {settlement.showFinancialDetails && settlement.summary ? (
        <OrderHistorySettlementDetails
          summary={settlement.summary}
          collectedPayments={settlement.collectedPayments}
          lang={lang}
          checkoutT={checkoutT}
        />
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

      <div className="rounded-lg border border-brand-border/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setOrderItemsOpen((open) => !open)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left text-[13px] text-brand-text-muted hover:bg-brand-border/20 transition-colors"
        >
          <span>{checkoutT.orderItemsCount.replace('{n}', String(detail.tableLines.length))}</span>
          <span aria-hidden>{orderItemsOpen ? '▾' : '▸'}</span>
        </button>
        {orderItemsOpen ? (
          detail.tableLines.length === 0 ? (
            <p className="text-brand-text-muted text-sm px-3 pb-3">{checkoutT.orderItemsEmpty}</p>
          ) : (
            <div className="border-t border-brand-border/60">
              {detail.tableLines.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-2 px-3 py-2 border-b border-brand-border/40 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                    <span className="text-brand-text text-sm font-medium truncate">
                      {line.label || '—'}
                    </span>
                    <span className="text-brand-text text-[13px] tabular-nums">
                      {line.quantityLabel}
                    </span>
                  </div>
                  <span className="text-brand-text text-sm font-semibold tabular-nums shrink-0">
                    €{line.lineTotal.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-brand-border/25 text-sm">
                <span className="text-brand-text font-medium">{checkoutT.orderItemsTotal}</span>
                <span className="text-brand-text font-semibold tabular-nums">
                  €{detail.tableLinesTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
