'use client';

import { useMemo } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { OrderHistoryBillDetailPanel } from '@/components/dashboard/OrderHistoryBillDetailPanel';
import { Modal } from '@/components/ui/Modal';
import { resolveOrderHistoryOutcomeBadge } from '@/lib/order-history/build-detail-presentation';
import { buildOrderHistoryBillDetailView } from '@/lib/order-history/build-bill-detail-view';
import { resolveBillPrintButtonLabel } from '@/lib/order-history/order-history-print-labels';
import {
  staffBillPrintCooldownKey,
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

const OUTCOME_BADGE_CLASS: Record<'success' | 'warning' | 'muted', string> = {
  success: 'bg-brand-gold/15 text-brand-gold border-brand-gold/30',
  warning: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  muted: 'bg-brand-border/40 text-brand-text-muted border-brand-border/60',
};

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
    printSplitReceipt,
    isPrintBillBusy,
    isPrintReceiptBusy,
    cooldownSecondsLeft,
    isOnCooldown,
  } = useStaffCheckoutBillPrint(restaurantSlug);

  const detail = useMemo(
    () => (entry ? buildOrderHistoryBillDetailView(entry, itemCodeByMenuId, lang) : null),
    [entry, itemCodeByMenuId, lang],
  );

  if (!entry || !detail) return null;

  const outcomeBadge = resolveOrderHistoryOutcomeBadge(entry.settlement.outcome, i18n);
  const billSplit = entry.billSplit;
  const billSplitId = billSplit?.id ?? '';
  const billCooldownKey = billSplitId ? staffBillPrintCooldownKey(billSplitId) : '';
  const billBusy = billSplitId ? isPrintBillBusy(billSplitId) : false;
  const billOnCooldown = billCooldownKey ? isOnCooldown(billCooldownKey) : false;
  const billCooldownSeconds = billCooldownKey ? cooldownSecondsLeft(billCooldownKey) : 0;

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
              className={`inline-flex text-[11px] px-2 py-0.5 rounded-full border ${OUTCOME_BADGE_CLASS[outcomeBadge.tone]}`}
            >
              {outcomeBadge.label}
            </span>
            <p className="text-sm text-brand-text">{detail.statusStrip}</p>
          </div>
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
                if (billSplit) void printCheckoutBill(billSplit);
              }}
              disabled={!billSplit || billBusy || billOnCooldown}
              className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors"
            >
              {resolveBillPrintButtonLabel(
                billSplit,
                checkoutT,
                billBusy,
                billOnCooldown ? billCooldownSeconds : 0,
              )}
            </button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
