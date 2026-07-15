'use client';

import { useState } from 'react';
import { CollectedPaymentsLedger } from '@/components/dashboard/checkout/CollectedPaymentsLedger';
import { IntegerInput } from '@/components/ui/IntegerInput';
import { CloseTableSessionAction } from '@/components/dashboard/CloseTableSessionAction';
import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import {
  formatCheckoutWaitDuration,
} from '@/lib/checkout-settlement';
import type { SplitSettlementRow } from '@/lib/checkout-split-settlement';
import { splitSettlementCollectAmount } from '@/lib/checkout-split-settlement';
import type { CheckoutDisplayLine } from '@/lib/checkout-session-lines';
import { checkoutPersonKey } from '@/lib/checkout-request-state';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { getMessages } from '@/lib/i18n/messages';
import type { UILanguage } from '@/lib/i18n';
import {
  formatCollectedPaymentTime,
} from '@/lib/format-dashboard-date';
import { formatPortugueseNif } from '@/lib/pt-nif';
import { localizeSplitPersonName } from '@/lib/split-person-label';
import type { BillSplit } from '@/types';

type CheckoutT = ReturnType<typeof getMessages>['checkout'];

interface Props {
  request: BillSplit;
  summary: CheckoutSettlementSummary;
  splitModeLabel: string;
  partialPaid: boolean;
  collectedPayments: SessionCollectedPayment[];
  pendingSettlementRows: SplitSettlementRow[];
  selectedLines: CheckoutDisplayLine[];
  processingKeys: Set<string>;
  detailLocked: boolean;
  resumeOperating: boolean;
  discountRate: number;
  discountApplying: boolean;
  discountLocked: boolean;
  resumeBlockReason: string | null;
  canCloseTable: boolean;
  printBillBusy: boolean;
  printCooldownSeconds: number;
  printOnCooldown: boolean;
  showSplitReceiptActions: boolean;
  onPrintSplitReceipt: (payment: SessionCollectedPayment) => void;
  isPrintReceiptBusy: (payment: SessionCollectedPayment) => boolean;
  printReceiptCooldownSeconds: (payment: SessionCollectedPayment) => number;
  isPrintReceiptOnCooldown: (payment: SessionCollectedPayment) => boolean;
  showBackButton: boolean;
  lang: UILanguage;
  t: CheckoutT;
  onBack: () => void;
  onDiscountRateChange: (rate: number) => void;
  onDiscountRateFocus: () => void;
  onDiscountRateBlur: () => void;
  onConfirmPersonPaid: (rowIndex: number) => void;
  onPrintBill: () => void;
  onResumeOrderingClick: () => void;
  onCloseTable: () => void;
}

function SettlementBar({
  summary,
  discountRate,
  discountApplying,
  discountLocked,
  detailLocked,
  t,
  onDiscountRateChange,
  onDiscountRateFocus,
  onDiscountRateBlur,
}: {
  summary: CheckoutSettlementSummary;
  discountRate: number;
  discountApplying: boolean;
  discountLocked: boolean;
  detailLocked: boolean;
  t: CheckoutT;
  onDiscountRateChange: (rate: number) => void;
  onDiscountRateFocus: () => void;
  onDiscountRateBlur: () => void;
}) {
  return (
    <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm min-w-0 flex-1">
          <span className="text-brand-text-muted">
            {t.settlementConsumption}{' '}
            <span className="text-brand-text tabular-nums font-medium">
              €{summary.consumption.toFixed(2)}
            </span>
          </span>
          <span className="text-brand-text-muted">
            {t.finalAmount}{' '}
            <span className="text-brand-text tabular-nums font-medium">
              €{summary.payable.toFixed(2)}
            </span>
          </span>
          {summary.collected > 0 ? (
            <span className="text-brand-text-muted">
              {t.settlementCollected}{' '}
              <span className="tabular-nums">€{summary.collected.toFixed(2)}</span>
            </span>
          ) : null}
          <span className="text-brand-text-muted">
            {t.settlementPending}{' '}
            <span className="text-brand-gold font-semibold tabular-nums">
              €{summary.pending.toFixed(2)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <span className="text-[13px] text-brand-text-muted">{t.discountRate}</span>
          <IntegerInput
            min={0}
            max={100}
            value={discountRate}
            onChange={onDiscountRateChange}
            onFocus={onDiscountRateFocus}
            onBlur={onDiscountRateBlur}
            className="w-16 bg-brand-bg border border-brand-border rounded-lg px-2 py-1 text-sm text-brand-text text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            placeholder="0"
            disabled={discountLocked || discountApplying || detailLocked}
            title={discountLocked ? t.discountLockedAfterPayment : undefined}
          />
          <span className="text-brand-text-muted text-sm">%</span>
        </div>
      </div>
    </div>
  );
}

export function CheckoutRequestDetail({
  request,
  summary,
  splitModeLabel,
  partialPaid,
  collectedPayments,
  pendingSettlementRows,
  selectedLines,
  processingKeys,
  detailLocked,
  resumeOperating,
  discountRate,
  discountApplying,
  discountLocked,
  resumeBlockReason,
  canCloseTable,
  printBillBusy,
  printCooldownSeconds,
  printOnCooldown,
  showSplitReceiptActions,
  onPrintSplitReceipt,
  isPrintReceiptBusy,
  printReceiptCooldownSeconds,
  isPrintReceiptOnCooldown,
  showBackButton,
  lang,
  t,
  onBack,
  onDiscountRateChange,
  onDiscountRateFocus,
  onDiscountRateBlur,
  onConfirmPersonPaid,
  onPrintBill,
  onResumeOrderingClick,
  onCloseTable,
}: Props) {
  const [orderItemsOpen, setOrderItemsOpen] = useState(false);
  const waitLabel = formatCheckoutWaitDuration(request.created_at, {
    durationJustNow: t.durationJustNow,
    durationMinutes: t.durationMinutes,
  });
  const requestedAt = formatCollectedPaymentTime(lang, request.created_at);
  const showCollectedLedger = collectedPayments.length > 0;

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl px-5 py-5 shadow-sm lg:sticky lg:top-4">
      {showBackButton ? (
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-brand-text-muted hover:text-brand-gold transition-colors mb-4 lg:hidden"
        >
          ← {t.backToList}
        </button>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-heading text-3xl text-brand-text leading-none">
            {t.table} {request.display_name}
          </p>
          <p className="text-brand-text-muted text-[13px] mt-2 tabular-nums">
            {requestedAt} {t.requestedAtLabel} · {waitLabel}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-border/50 text-brand-text-muted">
              {splitModeLabel}
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                partialPaid ? 'mesa-badge-warning' : 'mesa-badge-warning'
              }`}
            >
              {partialPaid ? t.partialPaidBadge : t.requested}
            </span>
          </div>
          {request.customer_nif ? (
            <p className="text-brand-text text-[13px] mt-2">
              {t.customerNif}:{' '}
              <span className="font-mono tabular-nums">
                {formatPortugueseNif(request.customer_nif)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <SettlementBar
          summary={summary}
          discountRate={discountRate}
          discountApplying={discountApplying}
          discountLocked={discountLocked}
          detailLocked={detailLocked}
          t={t}
          onDiscountRateChange={onDiscountRateChange}
          onDiscountRateFocus={onDiscountRateFocus}
          onDiscountRateBlur={onDiscountRateBlur}
        />
      </div>

      {pendingSettlementRows.length > 0 ? (
        <div className="mt-4 rounded-lg border-2 border-brand-gold/35 bg-brand-gold/5 p-3">
          <p className="text-[13px] font-medium text-brand-text mb-2">{t.pendingCollectionsTitle}</p>
          <div className="space-y-2">
            {pendingSettlementRows.map((row) => {
              const collectNow = splitSettlementCollectAmount(row);
              const showOwedTotal = row.settlementStatus === 'partial';
              return (
                <div
                  key={`${request.id}-${row.index}`}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="text-brand-text font-medium">
                      {localizeSplitPersonName(row.name, lang)}
                    </span>
                    {showOwedTotal ? (
                      <p className="text-[11px] text-brand-text-muted tabular-nums mt-0.5">
                        {t.personOwedTotal.replace('{amount}', row.obligationAmount.toFixed(2))}
                        {' · '}
                        {t.collectedSoFar} €{row.collectedAmount.toFixed(2)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-brand-gold font-semibold text-base tabular-nums">
                      €{collectNow.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onConfirmPersonPaid(row.index)}
                      disabled={detailLocked}
                      className="text-sm font-semibold px-3 py-2 rounded-lg mesa-badge-success hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
                    >
                      {processingKeys.has(checkoutPersonKey(request.id, row.index))
                        ? t.processing
                        : t.confirmOnePaidAmount.replace('{amount}', collectNow.toFixed(2))}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {showCollectedLedger ? (
        <CollectedPaymentsLedger
          payments={collectedPayments}
          lang={lang}
          t={t}
          bordered={false}
          className="mt-3 px-1"
          showPrintReceiptActions={showSplitReceiptActions}
          onPrintReceipt={onPrintSplitReceipt}
          isPrintReceiptBusy={isPrintReceiptBusy}
          printReceiptCooldownSeconds={printReceiptCooldownSeconds}
          isPrintReceiptOnCooldown={isPrintReceiptOnCooldown}
        />
      ) : null}

      <div className="mt-3 rounded-lg border border-brand-border/60 overflow-hidden">
        <button
          type="button"
          onClick={() => setOrderItemsOpen((open) => !open)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left text-[13px] text-brand-text-muted hover:bg-brand-border/20 transition-colors"
        >
          <span>{t.orderItemsCount.replace('{n}', String(selectedLines.length))}</span>
          <span aria-hidden>{orderItemsOpen ? '▾' : '▸'}</span>
        </button>
        {orderItemsOpen ? (
          selectedLines.length === 0 ? (
            <p className="text-brand-text-muted text-sm px-3 pb-3">{t.orderItemsEmpty}</p>
          ) : (
            <div className="border-t border-brand-border/60">
              {selectedLines.map((line) => (
                <div
                  key={line.key}
                  className="flex items-center justify-between gap-2 px-3 py-2 border-b border-brand-border/40 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                    <span className="text-brand-text text-sm truncate">{line.label || '—'}</span>
                    <span className="text-brand-text-muted text-[13px]">{line.quantityLabel}</span>
                  </div>
                  <span className="text-brand-text text-sm tabular-nums shrink-0">
                    €{line.lineTotal.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-brand-border/25 text-sm">
                <span className="text-brand-text-muted">{t.orderItemsTotal}</span>
                <span className="text-brand-text tabular-nums">
                  €{request.total_amount.toFixed(2)}
                </span>
              </div>
            </div>
          )
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-brand-border/50 pt-4">
        <button
          type="button"
          onClick={onPrintBill}
          disabled={detailLocked || printBillBusy || printOnCooldown}
          className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors"
        >
          {printBillBusy
            ? t.printBillOperating
            : printOnCooldown
              ? t.printBillCooldown.replace('{n}', String(printCooldownSeconds))
              : t.printBill}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={onResumeOrderingClick}
              disabled={detailLocked || !!resumeBlockReason}
              title={resumeBlockReason === 'whole_table_paid' ? t.resumeOrderingBlockedWholeTable : undefined}
              className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors"
            >
              {resumeOperating ? t.resumeOrderingOperating : t.resumeOrdering}
            </button>
            {resumeBlockReason === 'whole_table_paid' ? (
              <p className="text-[11px] text-brand-text-muted max-w-[14rem] text-right">
                {t.resumeOrderingBlockedWholeTable}
              </p>
            ) : null}
          </div>
          {canCloseTable ? (
            <CloseTableSessionAction
              tableId={request.table_id}
              isCheckoutPending
              disabled={detailLocked}
              onClosed={onCloseTable}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
