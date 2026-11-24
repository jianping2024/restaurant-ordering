'use client';

import type { ReactNode } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { STORE_PICKER_MESSAGES } from '@/lib/i18n/store-picker-messages';

/**
 * Sole top bar of the store-less dashboard pages (store picker, multi-store overview):
 * logo · optional middle slot · sign out. `widthClass` matches the page's main column.
 */
export function StoreLessHeader({
  children,
  widthClass = 'max-w-4xl',
}: {
  children?: ReactNode;
  widthClass?: string;
}) {
  const { lang } = useLanguage();
  const t = STORE_PICKER_MESSAGES[lang];
  return (
    <header className="sticky top-0 z-20 border-b border-brand-border bg-brand-bg/95 backdrop-blur">
      <div className={`mx-auto flex h-14 ${widthClass} items-center gap-3 px-4`}>
        <ProductLogo size="sm" tone="ink" />
        <div className="flex min-w-0 flex-1 items-center">{children}</div>
        <button
          type="button"
          onClick={() => void dashboardSignOutAndRedirect()}
          className="min-h-11 shrink-0 rounded-lg px-3 text-sm text-brand-text-muted hover:bg-brand-border/40 hover:text-brand-text"
        >
          {t.logout}
        </button>
      </div>
    </header>
  );
}
