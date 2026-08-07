'use client';

import { useMemo } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { OrderHistoryBillDetailPanel } from '@/components/dashboard/OrderHistoryBillDetailPanel';
import {
  OrderHistoryMergeSourcesBlock,
  OrderHistoryMergeTargetLink,
} from '@/components/dashboard/OrderHistoryMergeNavigation';
import { Modal } from '@/components/ui/Modal';
import { isOperationalSourceCloseKind } from '@/lib/order-history/close-kind';
import { buildOrderHistoryBillDetailView } from '@/lib/order-history/build-bill-detail-view';
import {
  buildOperationalSourceDetailStatus,
  buildOrderHistorySurfaceMeta,
} from '@/lib/order-history/build-lifecycle-presentation';
import {
  OrderHistoryLifecycleSteps,
  OrderHistoryOutcomeBadge,
} from '@/components/dashboard/OrderHistoryLifecycleSteps';
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
      entry && !isOperationalSourceCloseKind(entry.closeKind)
        ? buildOrderHistoryBillDetailView(entry, itemCodeByMenuId, lang)
        : null,
    [entry, itemCodeByMenuId, lang],
  );

  if (!entry || !surface) return null;

  const { outcomeBadge, lifecycleSteps, lifecycleBoxClass } = surface;

  const statusHeader = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <OrderHistoryOutcomeBadge badge={outcomeBadge} size="md" />
        <p className="text-sm text-brand-text">
          {isOperationalSourceCloseKind(entry.closeKind)
            ? buildOperationalSourceDetailStatus(entry, i18n)
            : detail?.statusStrip}
        </p>
      </div>
      <OrderHistoryLifecycleSteps
        steps={lifecycleSteps}
        i18n={i18n}
        className={lifecycleBoxClass}
      />
    </div>
  );

  if (isOperationalSourceCloseKind(entry.closeKind)) {
    return (
      <Modal
        open
        onClose={onClose}
        title={`${i18n.table} ${entry.displayName}`}
        size="lg"
      >
        <div className="space-y-4 px-4 pb-5 pt-1 sm:px-6 sm:pb-6">
          {statusHeader}
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
        {statusHeader}

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
