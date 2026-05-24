'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  getActiveSettingsNavItem,
  isSettingsWideLayout,
} from '@/lib/settings-nav';
import { SettingsCollapsibleHint } from '@/components/dashboard/settings/SettingsCollapsibleHint';
import { SettingsSubnav } from '@/components/dashboard/settings/SettingsSubnav';

export function DashboardSettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const activeItem = getActiveSettingsNavItem(pathname);
  const pageTitle = activeItem ? hub[activeItem.labelKey] : hub.title;
  const pageHint =
    activeItem && !activeItem.skipShellHint ? hub[activeItem.hintKey] : '';
  const wide = isSettingsWideLayout(pathname);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <nav className="mb-4 text-[13px] text-brand-text-muted" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/dashboard/settings" className="hover:text-brand-gold transition-colors">
              {hub.title}
            </Link>
          </li>
          {activeItem && activeItem.id !== 'profile' ? (
            <>
              <li aria-hidden className="opacity-50">
                /
              </li>
              <li className="text-brand-text font-medium">{pageTitle}</li>
            </>
          ) : null}
        </ol>
      </nav>

      <div className="flex flex-col lg:flex-row lg:gap-6 xl:gap-8 lg:items-start min-w-0">
        <SettingsSubnav />

        <div className={`min-w-0 flex-1 w-full ${wide ? '' : 'max-w-4xl'}`}>
          <header className="mb-5 hidden lg:block">
            <h1 className="font-heading text-2xl sm:text-3xl text-brand-text">{pageTitle}</h1>
          </header>

          {pageHint ? <SettingsCollapsibleHint>{pageHint}</SettingsCollapsibleHint> : null}

          {children}
        </div>
      </div>
    </div>
  );
}
