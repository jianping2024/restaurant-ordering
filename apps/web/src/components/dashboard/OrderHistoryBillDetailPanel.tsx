'use client';

import { useMemo, type ReactNode } from 'react';
import { CheckoutTableItemsSection } from '@/components/dashboard/checkout/CheckoutTableItemsSection';
import { OrderHistoryPersonLedgerSection } from '@/components/dashboard/OrderHistoryPersonLedgerSection';
import { OrderHistorySettlementDetails } from '@/components/dashboard/OrderHistorySettlementDetails';
import { buildOrderHistoryBillDetailView } from '@/lib/order-history/build-bill-detail-view';
import type { OrderHistoryDetailSection } from '@/lib/order-history/build-detail-presentation';
import { formatForcedUnpaidCloseAnnotation } from '@/lib/order-history/resolve-close-annotation-label';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

type PrintHandlers = {
  showSplitReceiptActions: boolean;
  onPrintReceipt: (payment: SessionCollectedPayment) => void;
  isPrintReceiptBusy: (payment: SessionCollectedPayment) => boolean;
  printReceiptCooldownSeconds: (payment: SessionCollectedPayment) => number;
  isPrintReceiptOnCooldown: (payment: SessionCollectedPayment) => boolean;
};

type Props = {
  entry: OrderHistoryEntry;
  itemCodeByMenuId: Record<string, string>;
  lang: UILanguage;
  printHandlers?: PrintHandlers;
};

export function OrderHistoryBillDetailPanel({
  entry,
  itemCodeByMenuId,
  lang,
  printHandlers,
}: Props) {
  const checkoutT = getMessages(lang).checkout;
  const orderHistoryT = getMessages(lang).orderHistory;

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

  const tableItemsSection = (
    <CheckoutTableItemsSection
      key={entry.sessionId}
      lines={detail.tableLines}
      total={detail.tableLinesTotal}
      defaultOpen={detail.tableItemsDefaultOpen}
      labels={{
        orderItemsCount: checkoutT.orderItemsCount,
        orderItemsEmpty: checkoutT.orderItemsEmpty,
        orderItemsTotal: checkoutT.orderItemsTotal,
      }}
    />
  );

  const sectionNodes: Record<OrderHistoryDetailSection, ReactNode> = {
    settlement:
      detail.settlement != null ? (
        <OrderHistorySettlementDetails
          variant={detail.settlement.variant}
          summary={detail.settlement.summary}
          checkoutT={checkoutT}
          orderHistoryT={orderHistoryT}
        />
      ) : null,
    table_items: tableItemsSection,
    person_ledger: (
      <OrderHistoryPersonLedgerSection
        ledger={detail.personLedger}
        lang={lang}
        checkoutT={checkoutT}
        orderHistoryT={orderHistoryT}
        canExpandPersonDishes={detail.canExpandPersonDishes}
        shareLabels={personShareLabels}
        printHandlers={printHandlers}
      />
    ),
  };

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

      {detail.sectionOrder.map((section) => {
        const node = sectionNodes[section];
        return node ? <div key={section}>{node}</div> : null;
      })}
    </div>
  );
}
