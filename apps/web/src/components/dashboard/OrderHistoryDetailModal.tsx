'use client';

import { useMemo } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { OrderHistoryBillDetailPanel } from '@/components/dashboard/OrderHistoryBillDetailPanel';
import { Modal } from '@/components/ui/Modal';
import { ORDER_HISTORY_OUTCOME_BADGE_CLASS } from '@/lib/order-history/build-detail-presentation';
import { buildOrderHistoryBillDetailView } from '@/lib/order-history/build-bill-detail-view';
import { buildOrderHistorySurfaceMeta } from '@/lib/order-history/build-lifecycle-presentation';
import { resolveBillPrintButtonLabel } from '@/lib/order-history/order-history-print-labels';
import {
  staffBillPrintCooldownKey,
  staffSessionBillCooldownKey,
  staffSplitReceiptCooldownKey,
  useStaffCheckoutBillPrint,
} from '@/lib/use-staff-checkout-bill-print';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { OrderHistoryEntry } from '@/lib/order-history/types';
import { getMessages } from '@/lib/i18n/messages';

interface Props {
  entry: OrderHistoryEntry | null;
  itemCodeByMenuId: Record<string, string>;
  restaurantSlug: string;
  onClose: () => void;
}

export function OrderHistoryDetailModal({
  entry,
  itemCodeByMenuId,
  restaurantSlug,
  onClose,
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

  const detail = useMemo(
    () => (entry ? buildOrderHistoryBillDetailView(entry, itemCodeByMenuId, lang) : null),
    [entry, itemCodeByMenuId, lang],
  );

  const surface = useMemo(
    () => (entry ? buildOrderHistorySurfaceMeta(entry, i18n) : null),
    [entry, i18n],
  );

  if (!entry || !detail || !surface) return null;

  const { outcomeBadge, abnormal, lifecycle } = surface;
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
          <div
            className={`space-y-0.5 text-sm ${
              abnormal === 'strong'
                ? 'rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-brand-text'
                : 'text-brand-text-muted'
            }`}
          >
            <p>{lifecycle.openedLine}</p>
            <p>{lifecycle.closedLine}</p>
          </div>
        </div>

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
