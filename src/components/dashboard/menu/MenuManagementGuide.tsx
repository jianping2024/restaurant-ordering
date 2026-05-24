'use client';

import { useState } from 'react';
import type { getMessages } from '@/lib/i18n/messages';

type MenuManagerMessages = ReturnType<typeof getMessages>['menuManager'];

export function MenuManagementGuide({ t }: { t: MenuManagerMessages }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-brand-gold/25 bg-brand-gold/5 p-4 mb-6">
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
        <ol className="mt-3 space-y-2.5 text-[13px] text-brand-text list-decimal list-inside">
          <li>{t.guideStep1}</li>
          <li>{t.guideStep2}</li>
          <li>{t.guideStep3}</li>
        </ol>
      )}
    </div>
  );
}
