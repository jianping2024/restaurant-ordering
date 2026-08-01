'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { shouldPrefetchDashboardNav } from '@/lib/dashboard-paths';
import { SETTINGS_NAV_TABS } from '@/lib/settings-nav';
import { can, fromCapabilitiesPayload, type CapabilitiesPayload } from '@/lib/permissions/can';

function tabClass(active: boolean) {
  return `inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
    active
      ? 'border-brand-gold text-brand-text'
      : 'border-transparent text-brand-text-muted hover:border-brand-border hover:text-brand-text'
  }`;
}

type Props = {
  capabilities: CapabilitiesPayload;
  /** local-prem + backend admin — sole nav gate for system logs. */
  showSystemLogs?: boolean;
};

export function SettingsTabs({
  capabilities: capabilitiesPayload,
  showSystemLogs = false,
}: Props) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const capabilities = fromCapabilitiesPayload(capabilitiesPayload);

  const visibleTabs = SETTINGS_NAV_TABS.filter((item) => {
    if (item.backendAdminOnPremOnly) return showSystemLogs;
    return Boolean(item.permission && can(capabilities, item.permission));
  });

  if (visibleTabs.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={hub.title}
      className="mb-5 -mx-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
    >
      <div className="flex min-w-max border-b border-brand-border/80 px-1">
        {visibleTabs.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={shouldPrefetchDashboardNav(item.href)}
              aria-current={active ? 'page' : undefined}
              className={tabClass(active)}
            >
              <span className="text-base leading-none" aria-hidden>
                {item.icon}
              </span>
              <span>{hub[item.labelKey]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
