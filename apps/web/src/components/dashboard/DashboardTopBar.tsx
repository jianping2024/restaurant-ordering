'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { isDashboardKitchenShortcutEnabled } from '@/lib/restaurant-features';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { DashboardSettingsMenu } from '@/components/dashboard/DashboardSettingsMenu';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { buildDashboardTopNavItems, dashboardTopNavButtonClass, isNavItemActive, isOwnerRestaurantSettingsActive, type DashboardTopNavItem } from '@/lib/dashboard-top-nav';
import { type SettingsNavItem } from '@/lib/settings-nav';

function topNavTabClass(active: boolean): string {
  return dashboardTopNavButtonClass(active);
}

function OwnerRestaurantSettingsDropdown({
  items,
  active,
  label,
}: {
  items: SettingsNavItem[];
  active: boolean;
  label: string;
}) {
  const { lang } = useLanguage();
  const hub = getMessages(lang).settingsHub;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={topNavTabClass(active)}
      >
        <span aria-hidden>⚙</span>
        <span>{label}</span>
        <span className="text-[10px] opacity-70" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1.5 min-w-[11rem] rounded-xl border border-brand-border bg-brand-card py-1 shadow-lg shadow-black/10"
        >
          {items.map((item) => {
            const itemActive = item.isActive(pathname);
            return (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  itemActive
                    ? 'bg-brand-gold/10 text-brand-text font-medium'
                    : 'text-brand-text-muted hover:text-brand-text hover:bg-brand-bg/70'
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{hub[item.labelKey]}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function renderNavItem(
  item: DashboardTopNavItem,
  pathname: string,
  navT: ReturnType<typeof getMessages>['nav'],
  checkoutCount: number,
  onNavigate: () => void,
) {
  if (item.kind === 'dropdown') {
    return (
      <OwnerRestaurantSettingsDropdown
        key={item.id}
        items={item.items}
        active={isOwnerRestaurantSettingsActive(pathname)}
        label={navT.restaurantSettings}
      />
    );
  }

  const active = isNavItemActive(pathname, item);
  const label =
    item.labelKey === 'viewKitchen' ? navT.viewKitchen : navT[item.labelKey as keyof typeof navT];
  const badge = item.checkoutBadge ? checkoutCount : undefined;
  const className = topNavTabClass(active);

  const content = (
    <>
      <span aria-hidden>{item.icon}</span>
      <span>{label}</span>
      {badge != null && badge > 0 ? (
        <span className="ml-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-semibold text-white">
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
        className={className}
        onClick={onNavigate}
      >
        {content}
      </a>
    );
  }

  return (
    <Link key={item.id} href={item.href} className={className} onClick={onNavigate}>
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
  const navItems = buildDashboardTopNavItems({
    accessMode,
    restaurantSlug: restaurant.slug,
    kitchenShortcutEnabled,
  });

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-brand-border bg-brand-card">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <Link href={accessMode === 'cashier' ? '/dashboard/checkout' : '/dashboard'} className="shrink-0">
          <ProductLogo size="sm" />
        </Link>
        <nav
          aria-label={navT.mainNav}
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
        >
          <div className="flex min-w-max items-center gap-1.5 py-0.5">
            {navItems.map((item) => renderNavItem(item, pathname, navT, pendingCount, () => {}))}
          </div>
        </nav>
        <DashboardSettingsMenu logoutLabel={navT.logout} />
      </div>
    </header>
  );
}
