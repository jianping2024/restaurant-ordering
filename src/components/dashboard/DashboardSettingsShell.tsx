'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  SETTINGS_NAV_GROUPS,
  getActiveSettingsNavItem,
  isSettingsWideLayout,
} from '@/lib/settings-nav';
import { SettingsCollapsibleHint } from '@/components/dashboard/settings/SettingsCollapsibleHint';

function navLinkClass(active: boolean) {
  return `block rounded-lg px-3 py-2 text-sm transition-colors border ${
    active
      ? 'bg-brand-gold/15 border-brand-gold/40 text-brand-gold font-medium'
      : 'border-transparent text-brand-text-muted hover:text-brand-text hover:bg-brand-card/80'
  }`;
}

export function DashboardSettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const activeItem = getActiveSettingsNavItem(pathname);
  const pageTitle = activeItem ? hub[activeItem.labelKey] : hub.title;
  const pageHint = activeItem ? hub[activeItem.hintKey] : '';
  const wide = isSettingsWideLayout(pathname);

  const renderNavLinks = (compact?: boolean) =>
    SETTINGS_NAV_GROUPS.map((group) => (
      <div key={group.groupId} className={compact ? 'shrink-0' : 'mb-4 last:mb-0'}>
        <p
          className={`text-[11px] font-medium uppercase tracking-wide text-brand-text-muted/90 ${
            compact ? 'px-2 mb-1' : 'px-3 mb-1.5'
          }`}
        >
          {hub[group.groupKey]}
        </p>
        <ul className={compact ? 'flex gap-1' : 'space-y-0.5'}>
          {group.items.map((item) => {
            const active = item.isActive(pathname);
            const label = hub[item.labelKey];
            return (
              <li key={item.id} className={compact ? 'shrink-0' : undefined}>
                <Link href={item.href} className={navLinkClass(active)}>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    ));

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

      <div className="lg:hidden overflow-x-auto pb-3 mb-2 border-b border-brand-border/80">
        <div className="flex gap-4 min-w-max pr-2">{renderNavLinks(true)}</div>
      </div>

      <div className="flex flex-col lg:flex-row lg:gap-6 xl:gap-8 lg:items-start min-w-0">
        <aside className="hidden lg:block w-48 xl:w-52 shrink-0 sticky top-8 self-start rounded-xl border border-brand-border bg-brand-card/40 p-3">
          {renderNavLinks(false)}
        </aside>

        <div className={`min-w-0 flex-1 w-full ${wide ? '' : 'max-w-4xl'}`}>
          <header className="mb-5">
            <h1 className="font-heading text-2xl sm:text-3xl text-brand-text">{pageTitle}</h1>
          </header>

          {pageHint ? <SettingsCollapsibleHint>{pageHint}</SettingsCollapsibleHint> : null}

          {children}
        </div>
      </div>
    </div>
  );
}
