'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { getMessages } from '@/lib/i18n/messages';
import {
  dashboardTopNavItemLabel,
  dashboardTopNavPanelClass,
  isNavItemActive,
  type DashboardTopNavItem,
} from '@/lib/dashboard-top-nav';

type Props = {
  items: DashboardTopNavItem[];
  pathname: string;
  navT: ReturnType<typeof getMessages>['nav'];
  checkoutCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DashboardTopNavOverflowMenu({
  items,
  pathname,
  navT,
  checkoutCount,
  open,
  onOpenChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  if (items.length === 0) return null;

  const hasActiveOverflowItem = items.some((item) => isNavItemActive(pathname, item));

  return (
    <div ref={rootRef} className="relative shrink-0 sm:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={navT.moreMenu}
        onClick={() => onOpenChange(!open)}
        className={`relative inline-flex shrink-0 items-center justify-center rounded-lg min-h-11 min-w-11 text-lg font-medium transition-colors ${
          open || hasActiveOverflowItem
            ? 'bg-brand-gold/15 text-brand-text border border-brand-gold/35'
            : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/80 border border-transparent'
        }`}
      >
        <span aria-hidden>⋯</span>
        {hasActiveOverflowItem && !open ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-gold" aria-hidden />
        ) : null}
      </button>
      {open ? (
        <div role="menu" className={dashboardTopNavPanelClass()}>
          {items.map((item) => {
            const active = isNavItemActive(pathname, item);
            const label = dashboardTopNavItemLabel(item, navT);
            const badge = item.checkoutBadge ? checkoutCount : undefined;
            const rowClass = `flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
              active
                ? 'bg-brand-gold/10 text-brand-text border-l-2 border-brand-gold'
                : 'text-brand-text hover:bg-brand-bg/80 border-l-2 border-transparent'
            }`;

            const content = (
              <>
                <span aria-hidden>{item.icon}</span>
                <span className="flex-1 text-left">{label}</span>
                {badge != null && badge > 0 ? (
                  <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
                {item.external ? (
                  <span className="text-[10px] opacity-60" aria-hidden>
                    ↗
                  </span>
                ) : null}
              </>
            );

            if (item.external) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  className={rowClass}
                  onClick={() => onOpenChange(false)}
                >
                  {content}
                </a>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                className={rowClass}
                onClick={() => onOpenChange(false)}
              >
                {content}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
