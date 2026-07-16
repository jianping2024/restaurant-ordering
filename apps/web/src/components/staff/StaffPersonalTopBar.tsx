'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { ProductTopBarBrand, ProductTopBarTrailing } from '@/components/ui/ProductTopBarChrome';
import { dashboardTopNavButtonClass } from '@/lib/dashboard-top-nav';
import {
  isStaffPersonalNavItemActive,
  type StaffPersonalTopNavItem,
} from '@/lib/staff-personal-top-nav';

type Props = {
  logoHref: string;
  restaurantName: string;
  roleLabel: string;
  navItems: StaffPersonalTopNavItem[];
  settingsMenu: ReactNode;
};

function navItemLabel(
  item: StaffPersonalTopNavItem,
  navT: ReturnType<typeof getMessages>['nav'],
): string {
  if (item.labelKey === 'viewKitchen') return navT.viewKitchen;
  const key = item.labelKey as keyof typeof navT;
  return typeof navT[key] === 'string' ? (navT[key] as string) : item.labelKey;
}

function renderNavItem(
  item: StaffPersonalTopNavItem,
  pathname: string,
  navT: ReturnType<typeof getMessages>['nav'],
  compact: boolean,
) {
  const active = isStaffPersonalNavItemActive(pathname, item);
  const label = navItemLabel(item, navT);
  const className = dashboardTopNavButtonClass(active, compact);
  const ariaProps = compact ? { 'aria-label': label } : {};

  const content = (
    <>
      <span aria-hidden>{item.icon}</span>
      {compact ? null : <span>{label}</span>}
      {!compact && item.external ? (
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
        className={className}
        {...ariaProps}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      key={item.id}
      href={item.href}
      className={className}
      aria-current={active ? 'page' : undefined}
      {...ariaProps}
    >
      {content}
    </Link>
  );
}

/** Sticky personal-app top bar — logo, restaurant, role nav, role label, settings. */
export function StaffPersonalTopBar({
  logoHref,
  restaurantName,
  roleLabel,
  navItems,
  settingsMenu,
}: Props) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const navT = getMessages(lang).nav;
  const compactNav = navItems.length > 0 && navItems.length <= 2;

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-brand-border bg-brand-card">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <ProductTopBarBrand href={logoHref} restaurantName={restaurantName} />

        {navItems.length > 0 ? (
          <nav
            aria-label={navT.mainNav}
            className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] sm:overflow-visible"
          >
            <div className="flex min-w-max items-center gap-1 py-0.5 sm:gap-1.5">
              <div className="flex items-center gap-1 sm:hidden">
                {navItems.map((item) => renderNavItem(item, pathname, navT, compactNav))}
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                {navItems.map((item) => renderNavItem(item, pathname, navT, false))}
              </div>
            </div>
          </nav>
        ) : (
          <div className="min-w-0 flex-1" />
        )}

        <ProductTopBarTrailing roleLabel={roleLabel}>{settingsMenu}</ProductTopBarTrailing>
      </div>
    </header>
  );
}
