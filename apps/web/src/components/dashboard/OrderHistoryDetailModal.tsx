'use client';

import { useMemo } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { OrderHistorySettlementDetails } from '@/components/dashboard/OrderHistorySettlementDetails';
import { Modal } from '@/components/ui/Modal';
import { getMessages } from '@/lib/i18n/messages';
import {
  buildOrderHistoryDetailChips,
  orderListGuestLabelsFromLang,
} from '@/lib/order-list-display';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import { localizeSplitPersonName } from '@/lib/split-person-label';

interface Props {
  entry: OrderHistoryEntry | null;
  onClose: () => void;
}

function outcomeDetailMessage(
  entry: OrderHistoryEntry,
  i18n: ReturnType<typeof getMessages>['orderHistory'],
): string | null {
  switch (entry.settlement.outcome) {
    case 'partially_collected_closed':
      return i18n.partiallyCollectedClosedDetail;
    case 'unpaid_closed':
      return i18n.unpaidClosedDetail;
    default:
      return null;
  }
}

export function OrderHistoryDetailModal({ entry, onClose }: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const checkoutT = getMessages(lang).checkout;
  const guestLabels = useMemo(() => orderListGuestLabelsFromLang(lang), [lang]);

  const chips = useMemo(
    () =>
      entry
        ? buildOrderHistoryDetailChips(entry.orders, guestLabels, {
            suppressVoidStyling: entry.settlement.suppressVoidItemStyling,
          })
        : [],
    [entry, guestLabels],
  );

  if (!entry) return null;

  const { settlement } = entry;
  const outcomeMessage = outcomeDetailMessage(entry, i18n);
  const showPersonBalances =
    settlement.personBalances.length > 1 &&
    settlement.outcome !== 'closed_without_billing';

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

        {outcomeMessage ? (
          <p className="text-sm text-brand-text-muted">{outcomeMessage}</p>
        ) : null}

        {settlement.showFinancialDetails && settlement.summary ? (
          <OrderHistorySettlementDetails
            summary={settlement.summary}
            collectedPayments={settlement.collectedPayments}
            lang={lang}
            checkoutT={checkoutT}
          />
        ) : null}

        {showPersonBalances ? (
          <div className="rounded-lg border border-brand-border/60 px-3 py-2.5 space-y-2">
            <p className="text-[12px] text-brand-text-muted">{i18n.splitBalancesTitle}</p>
            {settlement.personBalances.map((person) => (
              <div
                key={person.name}
                className="flex items-start justify-between gap-3 text-[13px]"
              >
                <div className="min-w-0">
                  <span className="text-brand-text font-medium">
                    {localizeSplitPersonName(person.name, lang)}
                  </span>
                  <p className="text-[11px] text-brand-text-muted tabular-nums mt-0.5">
                    {checkoutT.personOwedTotal.replace('{amount}', person.owed.toFixed(2))}
                    {person.collected > 0 ? (
                      <>
                        {' · '}
                        {checkoutT.collectedSoFar} €{person.collected.toFixed(2)}
                      </>
                    ) : null}
                  </p>
                </div>
                {person.outstanding > 0 ? (
                  <span className="text-brand-gold font-medium tabular-nums shrink-0">
                    €{person.outstanding.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-brand-text-muted shrink-0">{i18n.personSettled}</span>
                )}
              </div>
            ))}
          </div>
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
      </div>
    </Modal>
  );
}
