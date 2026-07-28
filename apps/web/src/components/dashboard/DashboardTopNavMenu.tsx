'use client';

import Link from 'next/link';
import { useRef } from 'react';
import type { getMessages } from '@/lib/i18n/messages';
import { DashboardTopBarDropdownPanel } from '@/components/dashboard/DashboardTopBarDropdownPanel';
import { topNavCheckoutCountBadge } from '@/components/ui/ProductTopNavLink';
import type { DashboardAccessMode } from '@/lib/dashboard-access';
import {
  dashboardLogoHref,
  isNavItemActive,
  topNavItemLabel,
  type ProductTopNavItem,
} from '@/lib/dashboard-top-nav';
import { shouldPrefetchDashboardNav } from '@/lib/dashboard-paths';

type Props = {
  items: ProductTopNavItem[];
  quickActionIds: ReadonlySet<string>;
  accessMode: DashboardAccessMode;
  pathname: string;
  navT: ReturnType<typeof getMessages>['nav'];
  checkoutCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function topNavMenuRowClass(active: boolean): string {
  return `flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors ${
    active
      ? 'bg-brand-gold/10 text-brand-text border-l-2 border-brand-gold'
      : 'text-brand-text hover:bg-brand-bg/80 border-l-2 border-transparent'
  }`;
}

export function DashboardTopNavMenu({
  items,
  quickActionIds,
  accessMode,
  pathname,
  navT,
  checkoutCount,
  open,
  onOpenChange,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const logoHref = dashboardLogoHref(accessMode);
  const hasActiveMenuOnlyItem = items.some(
    (item) =>
      item.href !== logoHref &&
      !quickActionIds.has(item.id) &&
      isNavItemActive(pathname, item),
  );

  return (
    <div ref={rootRef} className="relative shrink-0 lg:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={navT.moreMenu}
        onClick={() => onOpenChange(!open)}
        className={`relative inline-flex shrink-0 items-center justify-center rounded-lg min-h-11 min-w-11 text-lg font-medium transition-colors ${
          open || hasActiveMenuOnlyItem
            ? 'bg-brand-gold/15 text-brand-text border border-brand-gold/35'
            : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/80 border border-transparent'
        }`}
      >
        <span aria-hidden>⋯</span>
        {hasActiveMenuOnlyItem && !open ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-gold" aria-hidden />
        ) : null}
      </button>
      <DashboardTopBarDropdownPanel
        open={open}
        onClose={() => onOpenChange(false)}
        anchorRef={rootRef}
        mobilePortal
      >
        {items.map((item) => {
          const active = isNavItemActive(pathname, item);
          const label = topNavItemLabel(item, navT);
          const badge = item.checkoutBadge ? checkoutCount : undefined;
          const rowClass = topNavMenuRowClass(active);

          const content = (
            <>
              <span aria-hidden>{item.icon}</span>
              <span className="flex-1 text-left">{label}</span>
              {badge != null && badge > 0 ? topNavCheckoutCountBadge(badge) : null}
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
              prefetch={shouldPrefetchDashboardNav(item.href)}
              role="menuitem"
              className={rowClass}
              onClick={() => onOpenChange(false)}
            >
              {content}
            </Link>
          );
        })}
      </DashboardTopBarDropdownPanel>
    </div>
  );
}
