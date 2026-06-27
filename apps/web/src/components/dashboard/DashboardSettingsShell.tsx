'use client';

import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  getActiveSettingsNavItem,
  isSettingsWideLayout,
} from '@/lib/settings-nav';
import { BuffetSettingsGuide } from '@/components/dashboard/settings/BuffetSettingsGuide';
import { SettingsTabs } from '@/components/dashboard/settings/SettingsTabs';

export function DashboardSettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const activeItem = getActiveSettingsNavItem(pathname);
  const pageTitle = activeItem ? hub[activeItem.labelKey] : hub.title;
  const pageSubtitle = activeItem?.hintKey ? hub[activeItem.hintKey] : '';
  const pageHelpModal =
    activeItem?.id === 'buffet' ? (
      <BuffetSettingsGuide />
    ) : null;
  const wide = isSettingsWideLayout(pathname);
  const narrowForm =
    pathname === '/dashboard/settings' || pathname === '/dashboard/settings/';

  const pageBody = (
    <>
      <header className="mb-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="font-heading text-2xl sm:text-3xl text-brand-text">{pageTitle}</h1>
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
      <SettingsTabs />

      <div className={`min-w-0 w-full ${wide ? '' : 'max-w-4xl'}`}>
        {narrowForm ? <div className="w-full max-w-2xl">{pageBody}</div> : pageBody}
      </div>
    </div>
  );
}
