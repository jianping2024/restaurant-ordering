'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import { ProductTopBarBrand, ProductTopBarTrailing } from '@/components/ui/ProductTopBarChrome';
import { dashboardTopNavButtonClass } from '@/lib/dashboard-top-nav';
import {
  buildStaffPersonalTopNavPresentation,
  isStaffLogoHrefActive,
  isStaffPersonalNavItemActive,
  type StaffPersonalTopNavItem,
} from '@/lib/staff-personal-top-nav';
import { staffTopBarChrome } from '@/lib/waiter-staff-sticky-chrome';

type Props = {
  logoHref: string;
  restaurantName: string;
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

/** Sticky personal-app top bar — logo, restaurant, role nav, account menu. */
export function StaffPersonalTopBar({
  logoHref,
  restaurantName,
  navItems,
  settingsMenu,
}: Props) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const navT = getMessages(lang).nav;
  const { items, quickActions } = buildStaffPersonalTopNavPresentation(navItems, logoHref);
  const logoActive = isStaffLogoHrefActive(pathname, logoHref);

  return (
    <header className={staffTopBarChrome.headerClassName}>
      <div className={staffTopBarChrome.rowClassName}>
        <ProductTopBarBrand
          href={logoHref}
          restaurantName={restaurantName}
          logoActive={logoActive}
        />

        {items.length > 0 ? (
          <nav aria-label={navT.mainNav} className={staffTopBarChrome.navClassName}>
            {quickActions.length > 0 ? (
              <div className="flex items-center gap-1 lg:hidden">
                {quickActions.map((item) => renderNavItem(item, pathname, navT, true))}
              </div>
            ) : null}
            <div className="hidden lg:flex items-center gap-1.5">
              {items.map((item) => renderNavItem(item, pathname, navT, false))}
            </div>
          </nav>
        ) : null}

        <ProductTopBarTrailing>{settingsMenu}</ProductTopBarTrailing>
      </div>
    </header>
  );
}
