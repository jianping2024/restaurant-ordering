'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { SETTINGS_NAV_GROUPS, getActiveSettingsNavItem } from '@/lib/settings-nav';

type Props = {
  pageTitle: string;
};

function itemLinkClass(active: boolean) {
  return `block rounded-lg px-3 py-2 text-sm transition-colors ${
    active
      ? 'bg-brand-gold/15 text-brand-gold font-medium'
      : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-card/80'
  }`;
}

export function SettingsSubnav({ pageTitle }: Props) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const activeItem = getActiveSettingsNavItem(pathname);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  if (!activeItem) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-brand-text font-medium hover:text-brand-gold transition-colors"
      >
        {pageTitle}
        <span className="text-brand-text-muted/80 text-xs" aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1.5 min-w-[min(100vw-2rem,16rem)] max-w-xs rounded-xl border border-brand-border bg-brand-card py-2 shadow-lg"
        >
          {SETTINGS_NAV_GROUPS.map((group) => (
            <div key={group.groupId} className="px-2 py-1">
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-text-muted/90">
                {hub[group.groupKey]}
              </p>
              <ul>
                {group.items.map((item) => {
                  const active = item.isActive(pathname);
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        role="menuitem"
                        className={itemLinkClass(active)}
                        onClick={() => setOpen(false)}
                      >
                        {hub[item.labelKey]}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
