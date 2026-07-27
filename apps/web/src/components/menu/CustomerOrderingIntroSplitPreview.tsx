'use client';

import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import {
  GUEST_SPLIT_MODE_ORDER,
  getGuestSplitGuidance,
} from '@/lib/i18n/guest-split-mode-messages';

type Props = {
  lang: UILanguage;
};

/** Static preview of by-dish split — copy from guest split guidance only. */
export function CustomerOrderingIntroSplitPreview({ lang }: Props) {
  const bill = getMessages(lang).bill;
  const guidance = getGuestSplitGuidance(lang);
  const highlightMode = 'by_item' as const;

  return (
    <div className="rounded-xl border border-brand-border bg-brand-bg/60 p-3">
      <p className="mb-2 text-[13px] font-medium text-brand-text">{bill.splitMode}</p>
      <div className="mb-2 grid grid-cols-3 gap-1.5">
        {GUEST_SPLIT_MODE_ORDER.map((mode) => {
          const label = guidance.modes[mode].label;
          const on = mode === highlightMode;
          return (
            <span
              key={mode}
              className={`rounded-xl py-2 text-center text-[11px] ${
                on
                  ? 'bg-brand-gold font-semibold text-brand-on-gold'
                  : 'border border-brand-border bg-brand-card text-brand-text-muted'
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>
      <p className="mb-2 text-[11px] leading-snug text-brand-text-muted">
        {guidance.introPreview.caption}
      </p>
      <div className="mb-2 space-y-1 border-t border-brand-border pt-2">
        {guidance.introPreview.lines.map((line) => (
          <p key={line} className="text-[11px] leading-snug text-brand-text">
            {line}
          </p>
        ))}
      </div>
      <div className="space-y-1 border-t border-brand-border pt-2">
        <p className="mb-1 text-[11px] font-medium text-brand-text">{bill.splitResult}</p>
        {guidance.introPreview.people.map((person) => (
          <div
            key={person.name}
            className="flex items-center justify-between text-[11px] text-brand-text"
          >
            <span>{person.name}</span>
            <span className="tabular-nums font-medium text-brand-gold">€{person.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
