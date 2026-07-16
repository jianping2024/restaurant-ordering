'use client';

import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

type Props = {
  lang: UILanguage;
};

const PREVIEW_AMOUNTS = ['12,50', '11,50'] as const;

export function CustomerOrderingIntroSplitPreview({ lang }: Props) {
  const bill = getMessages(lang).bill;
  const modeLabels = [bill.even, bill.byItem, bill.custom] as const;

  return (
    <div className="rounded-xl border border-brand-border bg-brand-bg/60 p-3">
      <p className="mb-2 text-[13px] font-medium text-brand-text">{bill.splitMode}</p>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {modeLabels.map((label, index) => (
          <span
            key={label}
            className={`rounded-xl py-2 text-center text-[11px] ${
              index === 0
                ? 'bg-brand-gold font-semibold text-brand-on-gold'
                : 'border border-brand-border bg-brand-card text-brand-text-muted'
            }`}
          >
            {label}
          </span>
        ))}
      </div>
      <p className="mb-2 text-[11px] leading-snug text-brand-text-muted">{bill.splitOptionalHint}</p>
      <div className="mb-2 border-t border-brand-border pt-2">
        <p className="mb-1.5 text-[11px] font-medium text-brand-text">{bill.splitResult}</p>
        <div className="space-y-1">
          {PREVIEW_AMOUNTS.map((amount, index) => (
            <div
              key={amount}
              className="flex items-center justify-between text-[11px] text-brand-text"
            >
              <span>
                {bill.guest} {index + 1}
              </span>
              <span className="tabular-nums font-medium text-brand-gold">€{amount}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-border">
          <div className="h-full w-full rounded-full bg-emerald-500" />
        </div>
        <span className="shrink-0 text-[10px] text-brand-text-muted">
          {bill.byItemProgress} 2/2
        </span>
      </div>
    </div>
  );
}
