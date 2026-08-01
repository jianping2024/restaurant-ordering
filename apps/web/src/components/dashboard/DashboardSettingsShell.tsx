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
import type { CapabilitiesPayload } from '@/lib/permissions/can';

type Props = {
  children: React.ReactNode;
  capabilities: CapabilitiesPayload;
  showSystemLogs?: boolean;
  /** From getWebAppBuildInfo — empty hides the footer. */
  webAppVersion?: string;
};

export function DashboardSettingsShell({
  children,
  capabilities,
  showSystemLogs = false,
  webAppVersion = '',
}: Props) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const activeItem = getActiveSettingsNavItem(pathname);
  const pageSubtitle = activeItem?.hintKey ? hub[activeItem.hintKey] : '';
  const pageHelpModal =
    activeItem?.id === 'buffet' ? (
      <BuffetSettingsGuide />
    ) : null;
  const showIntro = Boolean(pageSubtitle || pageHelpModal);
  const wide = isSettingsWideLayout(pathname);
  const narrowForm =
    pathname === '/dashboard/settings' || pathname === '/dashboard/settings/';
  const versionLine = webAppVersion
    ? hub.appVersion.replaceAll('{version}', webAppVersion)
    : '';

  const pageBody = (
    <>
      {showIntro ? (
        <header className="mb-4">
          {pageHelpModal ? (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">{pageHelpModal}</div>
          ) : null}
          {pageSubtitle ? (
            <p
              className={`max-w-3xl text-[13px] leading-snug text-brand-text-muted/90 ${
                pageHelpModal ? 'mt-1.5' : ''
              }`}
            >
              {pageSubtitle}
            </p>
          ) : null}
        </header>
      ) : null}

      {children}

      {versionLine ? (
        <p className="mt-8 text-[12px] tabular-nums text-brand-text-muted/80" data-testid="web-app-version">
          {versionLine}
        </p>
      ) : null}
    </>
  );

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <div className={`min-w-0 w-full ${wide ? '' : 'max-w-4xl'}`}>
        <SettingsTabs capabilities={capabilities} showSystemLogs={showSystemLogs} />
        {narrowForm ? <div className="w-full max-w-2xl">{pageBody}</div> : pageBody}
      </div>
    </div>
  );
}
