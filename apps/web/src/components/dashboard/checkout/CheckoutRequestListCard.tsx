'use client';

import {
  formatCollectedPaymentTime,
} from '@/lib/format-dashboard-date';
import type { CheckoutSettlementSummary } from '@/lib/checkout-settlement';
import { formatCheckoutWaitDuration } from '@/lib/checkout-settlement';
import type { UILanguage } from '@/lib/i18n';
import type { getMessages } from '@/lib/i18n/messages';
import type { BillSplit } from '@/types';

type CheckoutT = ReturnType<typeof getMessages>['checkout'];

interface Props {
  request: BillSplit;
  selected: boolean;
  summary: CheckoutSettlementSummary;
  splitModeLabel: string;
  paymentProgressLabel: string | null;
  partialPaid: boolean;
  lang: UILanguage;
  t: CheckoutT;
  onSelect: () => void;
}

export function CheckoutRequestListCard({
  request,
  selected,
  summary,
  splitModeLabel,
  paymentProgressLabel,
  partialPaid,
  lang,
  t,
  onSelect,
}: Props) {
  const waitLabel = formatCheckoutWaitDuration(request.created_at, {
    durationJustNow: t.durationJustNow,
    durationMinutes: t.durationMinutes,
  });
  const requestedAt = formatCollectedPaymentTime(lang, request.created_at);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-xl border px-4 py-3 text-left shadow-sm transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg ${
        selected
          ? 'border-brand-gold/70 bg-brand-gold/10 shadow-md'
          : 'border-amber-500/35 bg-amber-500/8 shadow-amber-900/5 hover:border-amber-500/55 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-2xl text-brand-text leading-none">
            {t.table} {request.display_name}
          </p>
          <p className="text-brand-text-muted text-[11px] mt-2 tabular-nums">
            {requestedAt} {t.requestedAtLabel} · {waitLabel}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-border/50 text-brand-text-muted">
              {splitModeLabel}
            </span>
            {paymentProgressLabel ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-border/50 text-brand-text-muted tabular-nums">
                {paymentProgressLabel}
              </span>
            ) : null}
            {partialPaid ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full mesa-badge-warning">
                {t.partialPaidBadge}
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full mesa-badge-warning">
                {t.requested}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-brand-text-muted">{t.settlementPending}</p>
          <p className="text-brand-gold font-semibold text-lg tabular-nums">
            €{summary.pending.toFixed(2)}
          </p>
          {summary.collected > 0 ? (
            <p className="text-[10px] text-brand-text-muted mt-1 tabular-nums">
              {t.settlementConsumption} €{summary.consumption.toFixed(2)}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}
