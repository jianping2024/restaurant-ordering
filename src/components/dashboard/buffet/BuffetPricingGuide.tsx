'use client';

import { useState } from 'react';
import type { getMessages } from '@/lib/i18n/messages';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

export function BuffetPricingGuide({ t }: { t: BuffetAdminMessages }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-brand-gold/25 bg-brand-gold/5 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <h2 className="text-sm font-medium text-brand-gold">{t.guideTitle}</h2>
        <span className="text-brand-text-muted/80 text-sm shrink-0" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <ol className="mt-3 space-y-2.5 text-[13px] text-brand-text list-decimal list-inside">
          <li>{t.guideStepBuffet}</li>
          <li>{t.guideStepSlots}</li>
          <li>{t.guideStepPrices}</li>
          <li>{t.guideStepSpecialDates}</li>
        </ol>
      ) : null}
    </div>
  );
}
