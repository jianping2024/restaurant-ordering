'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { OrderHistoryBillDetailPanel } from '@/components/dashboard/OrderHistoryBillDetailPanel';
import { Modal } from '@/components/ui/Modal';
import { ORDER_HISTORY_OUTCOME_BADGE_CLASS } from '@/lib/order-history/build-detail-presentation';
import { buildOrderHistoryBillDetailView } from '@/lib/order-history/build-bill-detail-view';
import {
  buildMergedSourceDetailStatus,
  formatMergeSourceLine,
} from '@/lib/order-history/build-merge-presentation';
import {
  buildOrderHistorySurfaceMeta,
  formatOrderHistoryInstant,
} from '@/lib/order-history/build-lifecycle-presentation';
import { resolveBillPrintButtonLabel } from '@/lib/order-history/order-history-print-labels';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import {
  staffBillPrintCooldownKey,
  staffSessionBillCooldownKey,
  staffSplitReceiptCooldownKey,
  useStaffCheckoutBillPrint,
} from '@/lib/use-staff-checkout-bill-print';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { getMessages } from '@/lib/i18n/messages';

interface Props {
  entry: OrderHistoryEntry | null;
  entries: OrderHistoryEntry[];
  itemCodeByMenuId: Record<string, string>;
  restaurantSlug: string;
  onClose: () => void;
  onSelectEntry: (entry: OrderHistoryEntry) => void;
}

function findEntryBySessionId(
  entries: OrderHistoryEntry[],
  sessionId: string,
): OrderHistoryEntry | undefined {
  return entries.find((row) => row.sessionId === sessionId);
}

function OrderHistoryMergeTargetLink({
  entry,
  entries,
  restaurantSlug,
  i18n,
  onSelectEntry,
}: {
  entry: OrderHistoryEntry;
  entries: OrderHistoryEntry[];
  restaurantSlug: string;
  i18n: ReturnType<typeof getMessages>['orderHistory'];
  onSelectEntry: (entry: OrderHistoryEntry) => void;
}) {
  const ctx = entry.mergeContext;
  if (!ctx?.targetSessionId) return null;

  if (ctx.targetStatus === 'open' || ctx.targetStatus === 'billing') {
    if (!ctx.targetTableId) return null;
    return (
      <Link
        href={`/${restaurantSlug}/waiter/${ctx.targetTableId}`}
        className="text-sm text-brand-gold hover:underline"
      >
        {i18n.viewActiveTargetTable}
      </Link>
    );
  }

  const targetEntry = findEntryBySessionId(entries, ctx.targetSessionId);
  if (!targetEntry) return null;

  return (
    <button
      type="button"
      className="text-sm text-brand-gold hover:underline"
      onClick={() => onSelectEntry(targetEntry)}
    >
      {i18n.viewTargetSession}
    </button>
  );
}

function OrderHistoryMergeSourcesBlock({
  entry,
  entries,
  i18n,
  onSelectEntry,
}: {
  entry: OrderHistoryEntry;
  entries: OrderHistoryEntry[];
  i18n: ReturnType<typeof getMessages>['orderHistory'];
  onSelectEntry: (entry: OrderHistoryEntry) => void;
}) {
  const sources = entry.mergeSources;
  if (!sources?.length) return null;

  return (
    <div className="rounded-lg border border-brand-border/60 bg-brand-bg/40 px-3 py-2.5 space-y-2">
      <p className="text-sm font-medium text-brand-text">{i18n.mergeSourcesTitle}</p>
      <ul className="space-y-1.5">
        {sources.map((source) => {
          const sourceEntry = findEntryBySessionId(entries, source.sourceSessionId);
          return (
            <li key={source.sourceSessionId}>
              {sourceEntry ? (
                <button
                  type="button"
                  className="text-[13px] text-brand-gold hover:underline text-left"
                  onClick={() => onSelectEntry(sourceEntry)}
                >
                  {formatMergeSourceLine(source, i18n, formatOrderHistoryInstant)}
                </button>
              ) : (
                <span className="text-[13px] text-brand-text-muted">
                  {formatMergeSourceLine(source, i18n, formatOrderHistoryInstant)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OrderHistoryDetailModal({
  entry,
  entries,
  itemCodeByMenuId,
  restaurantSlug,
  onClose,
  onSelectEntry,
}: Props) {
  const { lang } = useLanguage();
  const i18n = getMessages(lang).orderHistory;
  const checkoutT = getMessages(lang).checkout;
  const {
    printCheckoutBill,
    printSessionCheckoutBill,
    printSplitReceipt,
    isPrintBillBusy,
    isPrintSessionBillBusy,
    isPrintReceiptBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  } = useStaffCheckoutBillPrint(restaurantSlug);

  const surface = useMemo(
    () => (entry ? buildOrderHistorySurfaceMeta(entry, i18n) : null),
    [entry, i18n],
  );

  const detail = useMemo(
    () =>
      entry && entry.closeKind === 'billing'
        ? buildOrderHistoryBillDetailView(entry, itemCodeByMenuId, lang)
        : null,
    [entry, itemCodeByMenuId, lang],
  );

  if (!entry || !surface) return null;

  const { outcomeBadge, lifecycle, lifecycleBoxClass, isMergedSource } = surface;

  if (isMergedSource) {
    return (
      <Modal
        open
        onClose={onClose}
        title={`${i18n.table} ${entry.displayName}`}
        size="lg"
      >
        <div className="space-y-4 px-4 pb-5 pt-1 sm:px-6 sm:pb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex text-[11px] px-2 py-0.5 rounded-full border ${ORDER_HISTORY_OUTCOME_BADGE_CLASS[outcomeBadge.tone]}`}
              >
                {outcomeBadge.label}
              </span>
              <p className="text-sm text-brand-text">
                {buildMergedSourceDetailStatus(entry, i18n)}
              </p>
            </div>
            <div className={lifecycleBoxClass}>
              <p>{lifecycle.openedLine}</p>
              <p>{lifecycle.closedLine}</p>
            </div>
          </div>
          <OrderHistoryMergeTargetLink
            entry={entry}
            entries={entries}
            restaurantSlug={restaurantSlug}
            i18n={i18n}
            onSelectEntry={onSelectEntry}
          />
        </div>
      </Modal>
    );
  }

  if (!detail) return null;

  const billSplit = entry.billSplit;
  const billSplitId = billSplit?.id ?? '';
  const billCooldownKey = billSplitId
    ? staffBillPrintCooldownKey(billSplitId)
    : staffSessionBillCooldownKey(entry.sessionId);
  const billBusy = billSplitId
    ? isPrintBillBusy(billSplitId)
    : isPrintSessionBillBusy(entry.sessionId);
  const billOnCooldown = isOnCooldown(billCooldownKey);
  const billCooldownSeconds = billOnCooldown ? cooldownSecondsLeft(billCooldownKey) : 0;

  const printHandlers = {
    showSplitReceiptActions: detail.actions.canPrintSplitReceipts,
    onPrintReceipt: (payment: SessionCollectedPayment) => {
      if (!billSplit) return;
      void printSplitReceipt(billSplit, payment);
    },
    isPrintReceiptBusy: (payment: SessionCollectedPayment) =>
      billSplitId && payment.person_index != null
        ? isPrintReceiptBusy(billSplitId, payment.person_index)
        : false,
    printReceiptCooldownSeconds: (payment: SessionCollectedPayment) =>
      billSplitId && payment.person_index != null
        ? cooldownSecondsLeft(staffSplitReceiptCooldownKey(billSplitId, payment.person_index))
        : 0,
    isPrintReceiptOnCooldown: (payment: SessionCollectedPayment) =>
      billSplitId && payment.person_index != null
        ? isOnCooldown(staffSplitReceiptCooldownKey(billSplitId, payment.person_index))
        : false,
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${i18n.table} ${entry.displayName}`}
      size="lg"
    >
      <div className="space-y-4 px-4 pb-5 pt-1 sm:px-6 sm:pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex text-[11px] px-2 py-0.5 rounded-full border ${ORDER_HISTORY_OUTCOME_BADGE_CLASS[outcomeBadge.tone]}`}
            >
              {outcomeBadge.label}
            </span>
            <p className="text-sm text-brand-text">{detail.statusStrip}</p>
          </div>
          <div className={lifecycleBoxClass}>
            <p>{lifecycle.openedLine}</p>
            <p>{lifecycle.closedLine}</p>
          </div>
        </div>

        {entry.mergeSources?.length ? (
          <OrderHistoryMergeSourcesBlock
            entry={entry}
            entries={entries}
            i18n={i18n}
            onSelectEntry={onSelectEntry}
          />
        ) : null}

        <OrderHistoryBillDetailPanel
          entry={entry}
          itemCodeByMenuId={itemCodeByMenuId}
          lang={lang}
          printHandlers={printHandlers}
        />

        {detail.actions.canPrintBill ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-brand-border/50 pt-4">
            <button
              type="button"
              onClick={() => {
                if (billSplit) {
                  void printCheckoutBill(billSplit);
                  return;
                }
                void printSessionCheckoutBill(entry.tableId, entry.sessionId);
              }}
              disabled={billBusy || billOnCooldown}
              className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors"
            >
              {resolveBillPrintButtonLabel(
                checkoutT,
                billBusy,
                billCooldownSeconds,
              )}
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
