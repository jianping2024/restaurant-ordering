'use client';

import type { ReactNode } from 'react';
import { IntegerInput } from '@/components/ui/IntegerInput';
import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import type { getMessages } from '@/lib/i18n/messages';
import { checkoutSettlementBarStickyShellClass } from '@/lib/waiter-staff-sticky-chrome';
import { formatCheckoutDiscountLabel } from '@/lib/checkout-split-math';

export type CheckoutT = ReturnType<typeof getMessages>['checkout'];

export function SettlementBar({
  summary,
  discountRate,
  discountApplying,
  discountLocked,
  detailLocked,
  t,
  onDiscountRateCommit,
  onDiscountRateFocus,
  leading,
  stickyShellClass = checkoutSettlementBarStickyShellClass,
}: {
  summary: CheckoutSettlementSummary;
  discountRate: number;
  discountApplying: boolean;
  discountLocked: boolean;
  detailLocked: boolean;
  t: CheckoutT;
  /** Sole path: IntegerInput blur parse → commit (no business onBlur). */
  onDiscountRateCommit: (rate: number) => void;
  onDiscountRateFocus: () => void;
  /** Optional chrome above amounts (e.g. mobile back) — stays in the sticky strip. */
  leading?: ReactNode;
  /** Sole sticky shell — default under staff top bar. */
  stickyShellClass?: string;
}) {
  return (
    <div className={stickyShellClass}>
      {leading ? <div className="mb-1 lg:hidden">{leading}</div> : null}
      <div className="rounded-lg border border-brand-gold/30 bg-brand-gold/5 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm min-w-0 flex-1">
            <span className="text-brand-text-muted">
              {t.settlementConsumption}{' '}
              <span className="text-brand-text tabular-nums font-medium">
                €{summary.consumption.toFixed(2)}
              </span>
            </span>
            {summary.discountRate > 0 ? (
              <span className="text-brand-text-muted">
                {formatCheckoutDiscountLabel(
                  t.settlementDiscount,
                  summary.discountRate,
                  summary.discountSaved,
                )}
              </span>
            ) : null}
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
              onChange={onDiscountRateCommit}
              onFocus={onDiscountRateFocus}
              className="w-16 bg-brand-bg border border-brand-border rounded-lg px-2 py-1 text-brand-text text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              placeholder="0"
              disabled={discountLocked || discountApplying || detailLocked}
              title={discountLocked ? t.discountLockedAfterPayment : undefined}
            />
            <span className="text-brand-text-muted text-sm">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Checkout detail footer: cancel (leading) + resume — no 关台 (floor/table detail owns close). */
export function CheckoutSessionActions(props: {
  t: CheckoutT;
  detailLocked: boolean;
  resumeOperating: boolean;
  resumeBlockReason: string | null;
  onResumeOrderingClick: () => void;
  leading?: ReactNode;
}) {
  const {
    t,
    detailLocked,
    resumeOperating,
    resumeBlockReason,
    onResumeOrderingClick,
    leading,
  } = props;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-brand-border/50 pt-4">
      <div className="flex flex-wrap items-center gap-2">{leading}</div>
      <div className="flex flex-wrap items-center gap-2">
        {resumeBlockReason === 'individual_session' ? null : (
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
        )}
      </div>
    </div>
  );
}
