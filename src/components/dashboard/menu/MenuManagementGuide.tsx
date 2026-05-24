'use client';

import { useState } from 'react';
import type { getMessages } from '@/lib/i18n/messages';

type MenuManagerMessages = ReturnType<typeof getMessages>['menuManager'];

export function MenuManagementGuide({ t }: { t: MenuManagerMessages }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-brand-gold/25 bg-brand-gold/5 p-4 mb-6">
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
          <li>{t.guideStep1}</li>
          <li>{t.guideStep2}</li>
          <li>{t.guideStep3}</li>
        </ol>
      ) : null}
    </div>
  );
}
