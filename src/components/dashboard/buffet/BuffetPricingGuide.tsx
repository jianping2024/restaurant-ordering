'use client';

import { useState } from 'react';
import type { getMessages } from '@/lib/i18n/messages';

type BuffetAdminMessages = ReturnType<typeof getMessages>['buffetAdmin'];

export function BuffetPricingGuide({ t }: { t: BuffetAdminMessages }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-brand-gold/25 bg-brand-gold/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-brand-gold">{t.guideTitle}</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[12px] text-brand-text-muted hover:text-brand-text underline-offset-2 hover:underline"
        >
          {open ? t.guideHide : t.guideShow}
        </button>
      </div>
      {open && (
        <ol className="mt-3 space-y-2 text-[13px] text-brand-text-muted list-decimal list-inside">
          <li>{t.guideStep1}</li>
          <li>{t.guideStep2}</li>
          <li>{t.guideStep3}</li>
        </ol>
      )}
      {open && (
        <p className="mt-2 text-[12px] text-brand-text-muted/90 border-t border-brand-border/50 pt-2">
          {t.guideWeekendNote}
        </p>
      )}
    </div>
  );
}
