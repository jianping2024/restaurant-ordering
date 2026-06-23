'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  getActiveSettingsNavItem,
  isSettingsWideLayout,
} from '@/lib/settings-nav';
import { MenuSettingsGuide } from '@/components/dashboard/settings/MenuSettingsGuide';
import { BuffetSettingsGuide } from '@/components/dashboard/settings/BuffetSettingsGuide';
import { SettingsSubnav } from '@/components/dashboard/settings/SettingsSubnav';

export function DashboardSettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const activeItem = getActiveSettingsNavItem(pathname);
  const pageTitle = activeItem ? hub[activeItem.labelKey] : hub.title;
  const pageSubtitle = activeItem ? hub[activeItem.hintKey] : '';
  const pageHelpModal =
    activeItem?.id === 'menu' ? (
      <MenuSettingsGuide />
    ) : activeItem?.id === 'buffet' ? (
      <BuffetSettingsGuide />
    ) : null;
  const wide = isSettingsWideLayout(pathname);
  const narrowForm =
    pathname === '/dashboard/settings' || pathname === '/dashboard/settings/';

  const pageBody = (
    <>
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="font-heading text-2xl sm:text-3xl text-brand-text hidden lg:block">
            {pageTitle}
          </h1>
          {pageHelpModal}
        </div>
        {pageSubtitle ? (
          <p className="mt-1.5 max-w-3xl text-[13px] leading-snug text-brand-text-muted/90">
            {pageSubtitle}
          </p>
        ) : null}
      </header>

      {children}
    </>
  );

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <nav className="mb-4 text-[13px] text-brand-text-muted" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/dashboard/settings" className="hover:text-brand-gold transition-colors">
              {hub.title}
            </Link>
          </li>
          {activeItem ? (
            <>
              <li aria-hidden className="opacity-50">
                /
              </li>
              <li>
                <SettingsSubnav pageTitle={pageTitle} />
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      <div className={`min-w-0 w-full ${wide ? '' : 'max-w-4xl'}`}>
        {narrowForm ? <div className="w-full max-w-2xl">{pageBody}</div> : pageBody}
      </div>
    </div>
  );
}
