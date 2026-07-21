'use client';

import { CheckoutPersonShareExpandable } from '@/components/dashboard/checkout/CheckoutPersonShareExpandable';
import { formatCollectedPaymentTime } from '@/lib/format-dashboard-date';
import type { OrderHistoryPersonLedger } from '@/lib/order-history/build-bill-detail-view';
import { resolveSplitReceiptPrintLabel } from '@/lib/order-history/order-history-print-labels';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { UILanguage } from '@/lib/i18n';
import type { getMessages } from '@/lib/i18n/messages';
import { localizeSplitPersonName } from '@/lib/split-person-label';

type CheckoutT = ReturnType<typeof getMessages>['checkout'];
type OrderHistoryT = ReturnType<typeof getMessages>['orderHistory'];

type ShareLabels = {
  expand: string;
  collapse: string;
  empty: string;
};

type PrintHandlers = {
  showSplitReceiptActions: boolean;
  onPrintReceipt?: (payment: SessionCollectedPayment) => void;
  isPrintReceiptBusy?: (payment: SessionCollectedPayment) => boolean;
  printReceiptCooldownSeconds?: (payment: SessionCollectedPayment) => number;
  isPrintReceiptOnCooldown?: (payment: SessionCollectedPayment) => boolean;
};

type Props = {
  ledger: OrderHistoryPersonLedger;
  lang: UILanguage;
  checkoutT: CheckoutT;
  orderHistoryT: OrderHistoryT;
  canExpandPersonDishes: boolean;
  shareLabels: ShareLabels;
  printHandlers?: PrintHandlers;
};

export function OrderHistoryPersonLedgerSection({
  ledger,
  lang,
  checkoutT,
  orderHistoryT,
  canExpandPersonDishes,
  shareLabels,
  printHandlers,
}: Props) {
  if (!ledger.show || ledger.rows.length === 0) return null;

  const footerLabel =
    ledger.footer?.label === 'obligation'
      ? orderHistoryT.personLedgerObligationTotal
      : checkoutT.collectedPaymentsTotal;

  return (
    <div className="rounded-lg border border-brand-border/60 bg-brand-card/50 p-3">
      <p className="text-[13px] font-medium text-brand-text mb-2">
        {orderHistoryT.personLedgerTitle}
      </p>
      <div className="space-y-2">
        {ledger.rows.map((row) => {
          const printPayment = row.printPayment;
          const busy = printPayment
            ? (printHandlers?.isPrintReceiptBusy?.(printPayment) ?? false)
            : false;
          const onCooldown = printPayment
            ? (printHandlers?.isPrintReceiptOnCooldown?.(printPayment) ?? false)
            : false;
          const cooldownSeconds = printPayment
            ? (printHandlers?.printReceiptCooldownSeconds?.(printPayment) ?? 0)
            : 0;
          const printLabel = resolveSplitReceiptPrintLabel(checkoutT, busy, cooldownSeconds);
          const collectedAtLabel =
            row.latestCollectedAt != null
              ? orderHistoryT.personCollectedAt.replace(
                  '{time}',
                  formatCollectedPaymentTime(lang, row.latestCollectedAt),
                )
              : null;
          const paymentCountLabel =
            row.paymentCount > 1
              ? orderHistoryT.personPaymentCount.replace('{n}', String(row.paymentCount))
              : null;

          return (
            <CheckoutPersonShareExpandable
              key={row.index}
              canExpand={canExpandPersonDishes}
              shareLines={row.shareLines}
              labels={shareLabels}
              identity={
                <div className="min-w-0">
                  <span className="text-brand-text font-medium">
                    {localizeSplitPersonName(row.name, lang)}
                  </span>
                  {row.displayMode === 'partial' ? (
                    <p className="text-[11px] text-brand-text-muted tabular-nums mt-0.5">
                      {orderHistoryT.personOwedLine
                        .replace('{amount}', row.obligationAmount.toFixed(2))
                        .replace('{collected}', row.collectedAmount.toFixed(2))}
                    </p>
                  ) : null}
                  {collectedAtLabel || paymentCountLabel ? (
                    <p className="text-[11px] text-brand-text-muted mt-0.5">
                      {[collectedAtLabel, paymentCountLabel].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
              }
              trailing={
                <>
                  <span className="text-brand-gold font-semibold tabular-nums">
                    €
                    {(row.displayMode === 'obligation_only'
                      ? row.obligationAmount
                      : row.displayMode === 'partial'
                        ? row.outstandingAmount
                        : row.collectedAmount
                    ).toFixed(2)}
                  </span>
                  {row.displayMode === 'partial' && row.collectedAmount > 0 ? (
                    <span className="text-[11px] text-brand-text-muted tabular-nums">
                      {checkoutT.collectedSoFar} €{row.collectedAmount.toFixed(2)}
                    </span>
                  ) : null}
                  {printHandlers?.showSplitReceiptActions &&
                  printHandlers.onPrintReceipt &&
                  printPayment &&
                  printPayment.person_index != null ? (
                    <button
                      type="button"
                      onClick={() => printHandlers.onPrintReceipt?.(printPayment)}
                      disabled={busy || onCooldown}
                      className="text-[12px] font-semibold px-2.5 py-1 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {printLabel}
                    </button>
                  ) : null}
                </>
              }
            />
          );
        })}
      </div>
      {ledger.footer ? (
        <div className="flex items-center justify-between text-[12px] mt-1.5 pt-1.5 border-t border-brand-border/30">
          <span className="text-brand-text font-medium">{footerLabel}</span>
          <span className="text-brand-text tabular-nums font-semibold">
            €{ledger.footer.amount.toFixed(2)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
