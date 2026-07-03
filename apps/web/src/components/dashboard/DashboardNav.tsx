'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { useSignOutConfirmState, SignOutConfirmModal } from '@/lib/auth/sign-out-confirm';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { DashboardNavFooter } from '@/components/dashboard/DashboardNavFooter';
import { DashboardNavItem } from '@/components/dashboard/DashboardNavItem';
import { DashboardSidebarHeader } from '@/components/dashboard/DashboardSidebarHeader';
import { getMessages } from '@/lib/i18n/messages';
import { ProductLogo } from '@/components/ui/ProductLogo';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { navItemsForRole } from '@/lib/dashboard-feature-registry';
import { isDashboardKitchenShortcutEnabled } from '@/lib/restaurant-features';
import { DASHBOARD_SIDEBAR_WIDTH } from '@/components/dashboard/dashboard-nav-link';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';

const ownerNavItems = navItemsForRole('owner');
const frontdeskNavItems = navItemsForRole('frontdesk');
const cashierNavItems = navItemsForRole('cashier');

function isNavItemActive(
  pathname: string,
  item: { href: string; exact?: boolean; matchPrefix?: string },
): boolean {
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname.startsWith(item.href);
}

export function DashboardNav({
  restaurant,
  accessMode = 'owner',
}: {
  restaurant: DashboardNavRestaurant;
  accessMode?: DashboardAccessMode;
}) {
  const kitchenShortcutEnabled = isDashboardKitchenShortcutEnabled(restaurant.feature_flags);
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const navItems =
    accessMode === 'cashier'
      ? cashierNavItems
      : accessMode === 'frontdesk'
        ? frontdeskNavItems
        : ownerNavItems;
  const showKitchenShortcut = accessMode === 'frontdesk' && kitchenShortcutEnabled;
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pendingCount: checkoutRequestCount } = useCheckoutRequests();

  const { requestSignOut, modalOpen, modalConfirming, closeModal, confirmSignOut: runSignOut } =
    useSignOutConfirmState(() => dashboardSignOutAndRedirect(router));

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-brand-border bg-brand-card px-4">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="h-9 w-9 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text"
          aria-label="Open menu"
        >
          ☰
        </button>
        <ProductLogo size="md" />
        <div className="h-9 w-9" aria-hidden />
      </div>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={closeMobile}
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
        />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen ${DASHBOARD_SIDEBAR_WIDTH} flex-col border-r border-brand-border bg-brand-card transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <DashboardSidebarHeader
          logoUrl={restaurant.logo_url}
          restaurantName={restaurant.name}
          onCloseMobile={closeMobile}
        />

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {navItems.map((item) => (
            <DashboardNavItem
              key={item.href}
              href={item.href}
              active={isNavItemActive(pathname, item)}
              icon={item.icon}
              label={t[item.key]}
              onNavigate={closeMobile}
              badge={item.checkoutBadge ? checkoutRequestCount : undefined}
            />
          ))}
          {showKitchenShortcut ? (
            <DashboardNavItem
              href={`/${restaurant.slug}/kitchen`}
              active={false}
              icon="🍳"
              label={t.viewKitchen}
              onNavigate={closeMobile}
              external
            />
          ) : null}
        </nav>

        <DashboardNavFooter logoutLabel={t.logout} onLogout={requestSignOut} />
        <SignOutConfirmModal
          open={modalOpen}
          onClose={closeModal}
          onConfirm={runSignOut}
          confirming={modalConfirming}
        />
      </aside>
    </>
  );
}
