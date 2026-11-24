'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { MULTI_STORE_OVERVIEW_PATH } from '@/lib/dashboard-store-routes';
import { MULTI_STORE_OVERVIEW_MESSAGES } from '@/lib/i18n/multi-store-overview-messages';

/**
 * Multi-store overview entries (plan §8.4). Callers mount them only when
 * `accountHasMultiStoreEntry` holds; the page re-checks on its own.
 */

/** Store picker page: fixed card at the bottom. */
export function MultiStoreOverviewEntryCard() {
  const { lang } = useLanguage();
  const t = MULTI_STORE_OVERVIEW_MESSAGES[lang];
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-border bg-brand-card px-5 py-4">
      <span className="min-w-0">
        <span className="block font-medium">{t.title}</span>
        <span className="block text-sm text-brand-text-muted">{t.entryHint}</span>
      </span>
      <Link
        href={MULTI_STORE_OVERVIEW_PATH}
        className="inline-flex min-h-11 items-center rounded-lg border border-brand-border px-4 text-sm font-medium hover:border-brand-gold"
      >
        {t.title}
      </Link>
    </div>
  );
}

/** Top-bar store switcher: fixed row under the store list. */
export function MultiStoreOverviewEntryRow({ onNavigate }: { onNavigate?: () => void }) {
  const { lang } = useLanguage();
  const t = MULTI_STORE_OVERVIEW_MESSAGES[lang];
  return (
    <div className="mt-2 border-t border-brand-border pt-2">
      <Link
        href={MULTI_STORE_OVERVIEW_PATH}
        onClick={onNavigate}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-brand-text hover:bg-brand-border/40"
      >
        <span aria-hidden className="w-4 text-brand-ink">
          ▤
        </span>
        {t.title}
      </Link>
    </div>
  );
}
