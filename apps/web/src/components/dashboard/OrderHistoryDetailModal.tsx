'use client';

import { useMemo } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Modal } from '@/components/ui/Modal';
import { getMessages } from '@/lib/i18n/messages';
import {
  buildOrderHistoryDetailChips,
  orderListGuestLabelsFromLang,
} from '@/lib/order-list-display';
import type { OrderHistoryEntry } from '@/lib/order-history/types';

interface Props {
  entry: OrderHistoryEntry | null;
  onClose: () => void;
}

export function OrderHistoryDetailModal({ entry, onClose }: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const guestLabels = useMemo(() => orderListGuestLabelsFromLang(lang), [lang]);

  const chips = useMemo(
    () => (entry ? buildOrderHistoryDetailChips(entry.orders, guestLabels) : []),
    [entry, guestLabels],
  );

  if (!entry) return null;

  const split = entry.billSplit;
  const showSettlement = split?.status === 'paid' && entry.settlementAmount != null;
  const showUnpaidClosed = split?.status === 'cancelled' && entry.settlementAmount == null;

  return (
    <Modal
      open
      onClose={onClose}
      title={`${i18n.table} ${entry.displayName}`}
      size="lg"
    >
      <div className="space-y-4 px-4 pb-5 pt-1 sm:px-6 sm:pb-6">
        <div className="text-sm text-brand-text-muted">
          {new Date(entry.closedAt).toLocaleString()}
          {entry.openedByName ? (
            <>
              <span className="mx-2 text-brand-text-muted/50" aria-hidden>
                ·
              </span>
              {i18n.openedBy} {entry.openedByName}
            </>
          ) : null}
        </div>

        {showUnpaidClosed ? (
          <p className="text-sm text-brand-text-muted">{i18n.unpaidClosedDetail}</p>
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
                {chip.note ? <span className="text-brand-text ml-1">({chip.note})</span> : null}
                {chip.voided ? (
                  <span className="ml-1 no-underline text-brand-text-muted/80">
                    ({i18n.itemVoided})
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        )}

        {showSettlement ? (
          <div className="border-t border-brand-border pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-brand-text-muted">{i18n.settlementAmount}</span>
              <span className="text-brand-gold font-medium tabular-nums">
                €{entry.settlementAmount!.toFixed(2)}
              </span>
            </div>
            {split && (split.discount_rate ?? 0) > 0 ? (
              <div className="mt-2 flex items-center justify-between gap-3 text-brand-text-muted">
                <span>{i18n.settlementDiscount}</span>
                <span>{split.discount_rate ?? 0}%</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
