'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { SETTINGS_NAV_TABS } from '@/lib/settings-nav';

function tabClass(active: boolean) {
  return `inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
    active
      ? 'border-brand-gold text-brand-text'
      : 'border-transparent text-brand-text-muted hover:border-brand-border hover:text-brand-text'
  }`;
}

export function SettingsTabs() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;

  return (
    <nav
      aria-label={hub.title}
      className="mb-5 -mx-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
    >
      <div className="flex min-w-max border-b border-brand-border/80 px-1">
        {SETTINGS_NAV_TABS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.id}
              href={item.href}
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
