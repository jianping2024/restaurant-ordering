'use client';

import { useMemo } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { OrderHistorySettlementDetails } from '@/components/dashboard/OrderHistorySettlementDetails';
import { Modal } from '@/components/ui/Modal';
import { getMessages } from '@/lib/i18n/messages';
import type { OrderHistoryDetail } from '@/lib/order-history/types';

interface Props {
  detail: OrderHistoryDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

function outcomeDetailMessage(
  detail: OrderHistoryDetail,
  i18n: ReturnType<typeof getMessages>['orderHistory'],
): string | null {
  switch (detail.settlement.outcome) {
    case 'partially_collected_closed':
      return i18n.partiallyCollectedClosedDetail;
    case 'unpaid_closed':
      return i18n.unpaidClosedDetail;
    default:
      return null;
  }
}

export function OrderHistoryDetailModal({ detail, loading, error, onClose }: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const checkoutT = getMessages(lang).checkout;
  const open = loading || error != null || detail != null;

  const chips = useMemo(() => detail?.chips ?? [], [detail]);
  const outcomeMessage = detail ? outcomeDetailMessage(detail, i18n) : null;

  if (!open) return null;

  const title = detail
    ? `${i18n.table} ${detail.displayName}`
    : i18n.title;

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <div className="space-y-4 px-4 pb-5 pt-1 sm:px-6 sm:pb-6">
        {loading ? (
          <p className="text-sm text-brand-text-muted">{i18n.loadingDetail}</p>
        ) : error ? (
          <p className="text-sm text-brand-text-muted">{error}</p>
        ) : detail ? (
          <>
            <div className="text-sm text-brand-text-muted">
              {new Date(detail.closedAt).toLocaleString()}
              {detail.openedByName ? (
                <>
                  <span className="mx-2 text-brand-text-muted/50" aria-hidden>
                    ·
                  </span>
                  {i18n.openedBy} {detail.openedByName}
                </>
              ) : null}
            </div>

            {outcomeMessage ? (
              <p className="text-sm text-brand-text-muted">{outcomeMessage}</p>
            ) : null}

            {detail.settlement.showFinancialDetails && detail.settlement.summary ? (
              <OrderHistorySettlementDetails
                summary={detail.settlement.summary}
                collectedPayments={detail.settlement.collectedPayments}
                lang={lang}
                checkoutT={checkoutT}
              />
            ) : null}

            {chips.length === 0 ? (
              <p className="text-sm text-brand-text-muted">{i18n.detailItemsEmpty}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip.key}
                    className={`text-[13px] px-2.5 py-1 rounded-full ${
                      chip.voided
                        ? 'bg-brand-border/60 text-brand-text-muted/70 line-through'
                        : 'bg-brand-border text-brand-text-muted'
                    }`}
                  >
                    {chip.emoji} {chip.name} {chip.quantityLabel}
                    {chip.note ? (
                      <span className="text-brand-text ml-1">({chip.note})</span>
                    ) : null}
                    {chip.voided ? (
                      <span className="ml-1 no-underline text-brand-text-muted/80">
                        ({i18n.itemVoided})
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
