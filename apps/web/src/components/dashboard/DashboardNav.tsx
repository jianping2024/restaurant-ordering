'use client';

import { usePathname, useRouter } from 'next/navigation';
import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { useSignOutConfirmState, SignOutConfirmModal } from '@/lib/auth/sign-out-confirm';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { DashboardNavFooter } from '@/components/dashboard/DashboardNavFooter';
import { DashboardNavItem } from '@/components/dashboard/DashboardNavItem';
import { DashboardSidebarHeader } from '@/components/dashboard/DashboardSidebarHeader';
import { getMessages } from '@/lib/i18n/messages';
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

type DashboardNavProps = {
  restaurant: DashboardNavRestaurant;
  accessMode?: DashboardAccessMode;
  variant: 'docked' | 'drawer';
  onNavigate: () => void;
  onClose?: () => void;
};

export function DashboardNav({
  restaurant,
  accessMode = 'owner',
  variant,
  onNavigate,
  onClose,
}: DashboardNavProps) {
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
  const { pendingCount: checkoutRequestCount } = useCheckoutRequests();

  const { requestSignOut, modalOpen, modalConfirming, closeModal, confirmSignOut: runSignOut } =
    useSignOutConfirmState(() => dashboardSignOutAndRedirect(router));

  const positionClass =
    variant === 'drawer'
      ? 'fixed left-0 top-0 z-50 translate-x-0'
      : `relative shrink-0 ${DASHBOARD_SIDEBAR_WIDTH}`;

  return (
    <aside
      className={`flex h-screen flex-col border-r border-brand-border bg-brand-card ${positionClass} ${variant === 'drawer' ? DASHBOARD_SIDEBAR_WIDTH : ''}`}
    >
      <DashboardSidebarHeader
        logoUrl={restaurant.logo_url}
        restaurantName={restaurant.name}
        onClose={onClose}
        closeLabel={t.closeMenu}
      />

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {navItems.map((item) => (
          <DashboardNavItem
            key={item.href}
            href={item.href}
            active={isNavItemActive(pathname, item)}
            icon={item.icon}
            label={t[item.key]}
            onNavigate={onNavigate}
            badge={item.checkoutBadge ? checkoutRequestCount : undefined}
          />
        ))}
        {showKitchenShortcut ? (
          <DashboardNavItem
            href={`/${restaurant.slug}/kitchen`}
            active={false}
            icon="🍳"
            label={t.viewKitchen}
            onNavigate={onNavigate}
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
  );
}
