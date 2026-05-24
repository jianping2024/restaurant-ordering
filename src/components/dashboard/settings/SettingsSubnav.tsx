'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  SETTINGS_NAV_GROUPS,
  getActiveSettingsNavItem,
  type SettingsNavItem,
} from '@/lib/settings-nav';

const SELECT_CLASS =
  'w-full h-11 rounded-lg border border-brand-border bg-brand-card px-4 text-sm text-brand-text appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-brand-gold/50';

function navLinkClass(active: boolean) {
  return `block rounded-lg px-3 py-2 text-sm transition-colors border ${
    active
      ? 'bg-brand-gold/15 border-brand-gold/40 text-brand-gold font-medium'
      : 'border-transparent text-brand-text-muted hover:text-brand-text hover:bg-brand-card/80'
  }`;
}

function findNavItem(id: string): SettingsNavItem | undefined {
  for (const group of SETTINGS_NAV_GROUPS) {
    const item = group.items.find((i) => i.id === id);
    if (item) return item;
  }
  return undefined;
}

export function SettingsSubnav() {
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const activeItem = getActiveSettingsNavItem(pathname);
  const activeId = activeItem?.id ?? 'profile';

  const handleJump = (id: string) => {
    const item = findNavItem(id);
    if (!item || item.isActive(pathname)) return;
    router.push(item.href);
  };

  return (
    <>
      <div className="lg:hidden mb-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="settings-section-jump" className="text-sm font-medium text-brand-text">
            {hub.navJumpLabel}
          </label>
          <Link
            href="/dashboard/settings"
            className="text-[13px] text-brand-text-muted hover:text-brand-gold transition-colors shrink-0"
          >
            {hub.title}
          </Link>
        </div>
        <div className="relative">
          <select
            id="settings-section-jump"
            value={activeId}
            onChange={(e) => handleJump(e.target.value)}
            className={SELECT_CLASS}
          >
            {SETTINGS_NAV_GROUPS.map((group) => (
              <optgroup key={group.groupId} label={hub[group.groupKey]}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {hub[item.labelKey]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-brand-text-muted text-sm"
            aria-hidden
          >
            ▾
          </span>
        </div>
      </div>

      <aside className="hidden lg:block w-48 xl:w-52 shrink-0 sticky top-8 self-start rounded-xl border border-brand-border bg-brand-card/40 p-3">
        {SETTINGS_NAV_GROUPS.map((group) => (
          <div key={group.groupId} className="mb-4 last:mb-0">
            <p className="px-3 mb-1.5 text-[11px] font-medium uppercase tracking-wide text-brand-text-muted/90">
              {hub[group.groupKey]}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <li key={item.id}>
                    <Link href={item.href} className={navLinkClass(active)}>
                      {hub[item.labelKey]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </aside>
    </>
  );
}
