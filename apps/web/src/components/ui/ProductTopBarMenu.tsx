'use client';

import Link from 'next/link';
import { useRef } from 'react';
import type { getMessages } from '@/lib/i18n/messages';
import { DashboardTopBarDropdownPanel } from '@/components/dashboard/DashboardTopBarDropdownPanel';
import {
  isNavItemActive,
  topNavDesktopLinkClass,
  topNavItemLabel,
  topNavIconTriggerClass,
  topNavMenuRowClass,
  type ProductTopNavItem,
  type StaffTopBarNavSurface,
} from '@/lib/dashboard-top-nav';
import { shouldPrefetchDashboardNav } from '@/lib/dashboard-paths';

function topNavCheckoutCountBadge(count: number) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

type Props = {
  items: ProductTopNavItem[];
  pathname: string;
  navT: ReturnType<typeof getMessages>['nav'];
  navSurface: StaffTopBarNavSurface;
  checkoutCount?: number;
  prefetch?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
};

function NavMenuRows({
  items,
  pathname,
  navT,
  checkoutCount,
  prefetch,
  onNavigate,
}: {
  items: ProductTopNavItem[];
  pathname: string;
  navT: ReturnType<typeof getMessages>['nav'];
  checkoutCount: number;
  prefetch: boolean;
  onNavigate: () => void;
}) {
  return (
    <>
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
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
            >
              {content}
            </a>
          );
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            prefetch={prefetch ? shouldPrefetchDashboardNav(item.href) : undefined}
            role="menuitem"
            className={rowClass}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            {content}
          </Link>
        );
      })}
    </>
  );
}

/** Hamburger nav menu (+ optional owner desktop inline links). */
export function ProductTopBarMenu({
  items,
  pathname,
  navT,
  navSurface,
  checkoutCount = 0,
  prefetch = false,
  open,
  onOpenChange,
  onNavigate,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const hasActiveItem = items.some((item) => isNavItemActive(pathname, item));
  const menuBadgeCount = items.reduce(
    (sum, item) => (item.checkoutBadge ? sum + checkoutCount : sum),
    0,
  );
  const closeMenu = () => onOpenChange(false);
  const handleNavigate = () => {
    closeMenu();
    onNavigate?.();
  };
  const hamburgerWrapClass =
    navSurface === 'hamburger-only'
      ? 'relative flex shrink-0 self-stretch items-stretch'
      : 'relative flex shrink-0 self-stretch items-stretch lg:hidden';
  const desktopInlineClass =
    navSurface === 'hamburger-mobile-inline-desktop'
      ? 'ml-2 hidden min-w-0 items-center gap-3 lg:flex'
      : 'hidden';

  return (
    <>
      <nav aria-label={navT.mainNav} className={desktopInlineClass}>
        {items.map((item) => {
          const active = isNavItemActive(pathname, item);
          const label = topNavItemLabel(item, navT);
          const badge = item.checkoutBadge ? checkoutCount : undefined;
          const className = topNavDesktopLinkClass(active);

          if (item.external) {
            return (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                aria-current={active ? 'page' : undefined}
              >
                {label}
                <span className="ml-0.5 text-[10px] opacity-60" aria-hidden>
                  ↗
                </span>
              </a>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              prefetch={prefetch ? shouldPrefetchDashboardNav(item.href) : undefined}
              className={className}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate?.()}
            >
              {label}
              {badge != null && badge > 0 ? (
                <span className="ml-1">{topNavCheckoutCountBadge(badge)}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div ref={rootRef} className={hamburgerWrapClass}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={navT.mainNav}
          onClick={() => onOpenChange(!open)}
          className={topNavIconTriggerClass(open)}
        >
          <span aria-hidden>☰</span>
          {menuBadgeCount > 0 && !open ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
              {menuBadgeCount > 99 ? '99+' : menuBadgeCount}
            </span>
          ) : null}
          {hasActiveItem && !open && menuBadgeCount <= 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-gold" aria-hidden />
          ) : null}
        </button>
        <DashboardTopBarDropdownPanel
          open={open}
          onClose={closeMenu}
          anchorRef={rootRef}
          mobilePortal
        >
          <NavMenuRows
            items={items}
            pathname={pathname}
            navT={navT}
            checkoutCount={checkoutCount}
            prefetch={prefetch}
            onNavigate={handleNavigate}
          />
        </DashboardTopBarDropdownPanel>
      </div>
    </>
  );
}
