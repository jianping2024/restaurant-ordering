'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';

export function SettingsCollapsibleHint({ children }: { children: string }) {
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-5 rounded-xl border border-brand-border/80 bg-brand-card/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left text-[13px] text-brand-text-muted hover:text-brand-text transition-colors"
      >
        <span>{open ? hub.hintHide : hub.hintShow}</span>
        <span className="text-brand-text-muted/80" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open ? (
        <p className="px-4 pb-3 text-[13px] text-brand-text-muted leading-relaxed border-t border-brand-border/60 pt-2">
          {children}
        </p>
      ) : null}
    </div>
  );
}
