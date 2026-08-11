'use client';

import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import type { getMessages } from '@/lib/i18n/messages';
import { DashboardTopBarDropdownPanel } from '@/components/dashboard/DashboardTopBarDropdownPanel';
import {
  isNavItemActive,
  topNavDesktopLinkClass,
  topNavDesktopScrollNavClassName,
  topNavItemLabel,
  topNavIconTriggerClass,
  topNavMenuRowClass,
  type ProductTopNavItem,
} from '@/lib/dashboard-top-nav';
import { shouldPrefetchDashboardNav } from '@/lib/dashboard-paths';

function topNavProBadge(label: string) {
  return (
    <span className="ml-1 inline-flex rounded border border-brand-gold/40 bg-brand-gold/10 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-gold">
      {label}
    </span>
  );
}

function topNavCheckoutCountBadge(count: number) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

type NavContext = {
  items: ProductTopNavItem[];
  pathname: string;
  navT: ReturnType<typeof getMessages>['nav'];
  checkoutCount: number;
  prefetch: boolean;
  onNavigate?: () => void;
};

function resolveNavItemDisplay(
  item: ProductTopNavItem,
  pathname: string,
  navT: ReturnType<typeof getMessages>['nav'],
  checkoutCount: number,
) {
  return {
    active: isNavItemActive(pathname, item),
    label: topNavItemLabel(item, navT),
    badge: item.checkoutBadge ? checkoutCount : undefined,
  };
}

type TopNavItemLinkProps = {
  item: ProductTopNavItem;
  active: boolean;
  className: string;
  prefetch: boolean;
  role?: string;
  onClick?: () => void;
  children: ReactNode;
};

/** Single link/anchor for a top-nav item — desktop row or mobile menu row. */
function TopNavItemLink({
  item,
  active,
  className,
  prefetch,
  role,
  onClick,
  children,
}: TopNavItemLinkProps) {
  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        role={role}
        className={className}
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={item.href}
      prefetch={prefetch ? shouldPrefetchDashboardNav(item.href) : undefined}
      role={role}
      className={className}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

function NavDesktopLinks({
  items,
  pathname,
  navT,
  checkoutCount,
  prefetch,
  onNavigate,
}: NavContext) {
  return (
    <div className="flex min-w-max items-center gap-3 px-0.5">
      {items.map((item) => {
        const { active, label, badge } = resolveNavItemDisplay(
          item,
          pathname,
          navT,
          checkoutCount,
        );

        return (
          <TopNavItemLink
            key={item.id}
            item={item}
            active={active}
            prefetch={prefetch}
            className={topNavDesktopLinkClass(active)}
            onClick={() => onNavigate?.()}
          >
            {label}
            {item.proLocked ? topNavProBadge(navT.proBadge) : null}
            {item.external ? (
              <span className="ml-0.5 text-[10px] opacity-60" aria-hidden>
                ↗
              </span>
            ) : null}
            {badge != null && badge > 0 ? (
              <span className="ml-1">{topNavCheckoutCountBadge(badge)}</span>
            ) : null}
          </TopNavItemLink>
        );
      })}
    </div>
  );
}

function NavMenuRows({
  items,
  pathname,
  navT,
  checkoutCount,
  prefetch,
  onNavigate,
}: NavContext & { onNavigate: () => void }) {
  return (
    <>
      {items.map((item) => {
        const { active, label, badge } = resolveNavItemDisplay(
          item,
          pathname,
          navT,
          checkoutCount,
        );

        return (
          <TopNavItemLink
            key={item.id}
            item={item}
            active={active}
            prefetch={prefetch}
            role="menuitem"
            className={topNavMenuRowClass(active)}
            onClick={onNavigate}
          >
            <span aria-hidden>{item.icon}</span>
            <span className="flex-1 text-left">{label}</span>
            {item.proLocked ? topNavProBadge(navT.proBadge) : null}
            {badge != null && badge > 0 ? topNavCheckoutCountBadge(badge) : null}
            {item.external ? (
              <span className="text-[10px] opacity-60" aria-hidden>
                ↗
              </span>
            ) : null}
          </TopNavItemLink>
        );
      })}
    </>
  );
}

type Props = {
  items: ProductTopNavItem[];
  pathname: string;
  navT: ReturnType<typeof getMessages>['nav'];
  checkoutCount?: number;
  prefetch?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
};

/** Mobile hamburger nav + desktop bounded chip-scroll links (cluster-capped). */
export function ProductTopBarMenu({
  items,
  pathname,
  navT,
  checkoutCount = 0,
  prefetch = false,
  open,
  onOpenChange,
  onNavigate,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const navContext: NavContext = {
    items,
    pathname,
    navT,
    checkoutCount,
    prefetch,
    onNavigate,
  };
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

  return (
    <>
      <nav aria-label={navT.mainNav} className={topNavDesktopScrollNavClassName()}>
        <NavDesktopLinks {...navContext} />
      </nav>

      <div ref={rootRef} className="relative flex shrink-0 self-stretch items-stretch lg:hidden">
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
            <span className="absolute -right-0.5 -top-0.5">
              {topNavCheckoutCountBadge(menuBadgeCount)}
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
          <NavMenuRows {...navContext} onNavigate={handleNavigate} />
        </DashboardTopBarDropdownPanel>
      </div>
    </>
  );
}
