'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { isDashboardKitchenShortcutEnabled } from '@/lib/restaurant-features';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { DashboardSettingsMenu } from '@/components/dashboard/DashboardSettingsMenu';
import { DashboardTopNavOverflowMenu } from '@/components/dashboard/DashboardTopNavOverflowMenu';
import { ProductLogo } from '@/components/ui/ProductLogo';
import {
  buildDashboardTopNavPresentation,
  dashboardLogoHref,
  dashboardTopNavButtonClass,
  dashboardTopNavItemLabel,
  isNavItemActive,
  type DashboardTopNavItem,
} from '@/lib/dashboard-top-nav';

type TopBarPanel = 'none' | 'more' | 'settings';

function CheckoutBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

function renderNavItem(
  item: DashboardTopNavItem,
  pathname: string,
  navT: ReturnType<typeof getMessages>['nav'],
  checkoutCount: number,
  compact: boolean,
  onNavigate: () => void,
) {
  const active = isNavItemActive(pathname, item);
  const label = dashboardTopNavItemLabel(item, navT);
  const badge = item.checkoutBadge ? checkoutCount : undefined;
  const className = dashboardTopNavButtonClass(active, compact);

  const content = (
    <>
      <span aria-hidden>{item.icon}</span>
      {compact ? null : <span>{label}</span>}
      {!compact && badge != null && badge > 0 ? (
        <span className="ml-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
      {compact && badge != null ? <CheckoutBadge count={badge} /> : null}
      {!compact && item.external ? (
        <span className="text-[10px] opacity-60" aria-hidden>
          ↗
        </span>
      ) : null}
    </>
  );

  const ariaProps = compact ? { 'aria-label': label } : {};

  if (item.external) {
    return (
      <a
        key={item.id}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
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
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      {...ariaProps}
    >
      {content}
    </Link>
  );
}

type Props = {
  restaurant: DashboardNavRestaurant;
  accessMode: DashboardAccessMode;
};

export function DashboardTopBar({ restaurant, accessMode }: Props) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const navT = getMessages(lang).nav;
  const { pendingCount } = useCheckoutRequests();
  const kitchenShortcutEnabled = isDashboardKitchenShortcutEnabled(restaurant.feature_flags);
  const { all, primary, overflow } = buildDashboardTopNavPresentation({
    accessMode,
    restaurantSlug: restaurant.slug,
    kitchenShortcutEnabled,
  });
  const [openPanel, setOpenPanel] = useState<TopBarPanel>('none');

  const closePanels = () => setOpenPanel('none');

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-brand-border bg-brand-card">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link href={dashboardLogoHref(accessMode)} className="shrink-0">
          <ProductLogo size="sm" />
        </Link>

        <nav
          aria-label={navT.mainNav}
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] sm:overflow-visible"
        >
          <div className="flex min-w-max items-center gap-1 py-0.5 sm:gap-1.5">
            <div className="flex items-center gap-1 sm:hidden">
              {primary.map((item) =>
                renderNavItem(item, pathname, navT, pendingCount, true, closePanels),
              )}
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              {all.map((item) =>
                renderNavItem(item, pathname, navT, pendingCount, false, closePanels),
              )}
            </div>
          </div>
        </nav>

        <DashboardTopNavOverflowMenu
          items={overflow}
          pathname={pathname}
          navT={navT}
          checkoutCount={pendingCount}
          open={openPanel === 'more'}
          onOpenChange={(open) => setOpenPanel(open ? 'more' : 'none')}
        />

        <DashboardSettingsMenu
          logoutLabel={navT.logout}
          compact
          open={openPanel === 'settings'}
          onOpenChange={(open) => setOpenPanel(open ? 'settings' : 'none')}
        />
      </div>
    </header>
  );
}
