'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { MENU_PAGE_MESSAGES } from '@/lib/i18n/menu-page-messages';

export function CustomerMenuCatalogSkeleton() {
  const { lang } = useLanguage();
  const label = MENU_PAGE_MESSAGES[lang].catalogLoading;

  return (
    <div className="px-4 pb-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">{label}</p>
      <div className="mb-4 h-10 w-full animate-pulse rounded-xl bg-brand-border/40" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-2xl border border-brand-border/40 bg-brand-card/60"
          />
        ))}
      </div>
    </div>
  );
}
