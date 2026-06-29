'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { useSignOutConfirmState, SignOutConfirmModal } from '@/lib/auth/sign-out-confirm';
import { createClient } from '@/lib/supabase/client';
import type { Restaurant } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { DashboardNavFooter } from '@/components/dashboard/DashboardNavFooter';
import { DashboardNavLink } from '@/components/dashboard/DashboardNavLink';
import { useDashboardNavLayout } from '@/components/dashboard/DashboardShell';
import { getMessages } from '@/lib/i18n/messages';
import { ProductLogo } from '@/components/ui/ProductLogo';
import type { DashboardAccessMode } from '@/lib/dashboard-access';
import { navItemsForRole } from '@/lib/dashboard-feature-registry';
import { isDashboardKitchenShortcutEnabled } from '@/lib/restaurant-features';
import { dashboardNavWidthClass } from '@/lib/dashboard-nav-layout';

const ownerNavItems = navItemsForRole('owner');
const frontdeskNavItems = navItemsForRole('frontdesk');
const cashierNavItems = navItemsForRole('cashier');

function NavCollapseToggle({
  collapsed,
  onToggle,
  expandLabel,
  collapseLabel,
}: {
  collapsed: boolean;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel: string;
}) {
  const label = collapsed ? expandLabel : collapseLabel;

  return (
    <button
      type="button"
      onClick={onToggle}
      className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-border text-brand-text-muted transition-colors hover:text-brand-text lg:inline-flex"
      aria-expanded={!collapsed}
      aria-controls="dashboard-nav"
      aria-label={label}
      title={label}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        {collapsed ? (
          <polyline points="9 18 15 12 9 6" />
        ) : (
          <polyline points="15 18 9 12 15 6" />
        )}
      </svg>
    </button>
  );
}

export function DashboardNav({
  restaurant,
  accessMode = 'owner',
}: {
  restaurant: Pick<Restaurant, 'id' | 'name' | 'slug' | 'feature_flags'>;
  accessMode?: DashboardAccessMode;
}) {
  const kitchenShortcutEnabled = isDashboardKitchenShortcutEnabled(restaurant.feature_flags);
  const pathname = usePathname();
  const router = useRouter();
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const { collapsed, toggleCollapsed } = useDashboardNavLayout();
  const [isLgUp, setIsLgUp] = useState(false);
  const navItems =
    accessMode === 'cashier'
      ? cashierNavItems
      : accessMode === 'frontdesk'
        ? frontdeskNavItems
        : ownerNavItems;
  const showKitchenShortcut = accessMode === 'frontdesk' && kitchenShortcutEnabled;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [checkoutRequestCount, setCheckoutRequestCount] = useState(0);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsLgUp(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (accessMode === 'owner') return;

    const supabase = createClient();
    let cancelled = false;

    const loadCheckoutRequestCount = async () => {
      const { count } = await supabase
        .from('bill_splits')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'requested')
        .not('session_id', 'is', null);

      if (!cancelled) setCheckoutRequestCount(count || 0);
    };

    void loadCheckoutRequestCount();

    const channel = supabase
      .channel(`nav-checkout-count-${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bill_splits',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadCheckoutRequestCount();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [accessMode, restaurant.id]);

  const { requestSignOut, modalOpen, modalConfirming, closeModal, confirmSignOut: runSignOut } =
    useSignOutConfirmState(() => dashboardSignOutAndRedirect(router));

  const handleGo = () => {
    setMobileOpen(false);
  };

  const showRail = collapsed && isLgUp;

  const isNavItemActive = (item: (typeof navItems)[number]) =>
    item.matchPrefix
      ? pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)
      : item.exact
        ? pathname === item.href
        : pathname.startsWith(item.href);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-brand-border bg-brand-card px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="h-9 w-9 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text"
          aria-label={t.openMenu}
        >
          ☰
        </button>
        <ProductLogo size="md" />
        <div className="h-9 w-9" aria-hidden />
      </div>

      {mobileOpen ? (
        <button
          type="button"
          aria-label={t.closeMenu}
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      <aside
        id="dashboard-nav"
        className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-brand-border bg-brand-card transition-[transform,width] duration-200 ease-out motion-reduce:transition-none ${dashboardNavWidthClass(collapsed)} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div
          className={`shrink-0 border-b border-brand-border py-5 lg:py-6 ${showRail ? 'px-2 lg:px-2' : 'px-6'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className={`min-w-0 flex-1 ${showRail ? 'flex justify-center lg:flex' : ''}`}>
              <ProductLogo size="md" variant={showRail ? 'mark' : 'full'} />
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="h-8 w-8 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text lg:hidden"
              aria-label={t.closeMenu}
            >
              ×
            </button>
            <NavCollapseToggle
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              expandLabel={t.expandSidebar}
              collapseLabel={t.collapseSidebar}
            />
          </div>
          {!showRail ? (
            <p className="mt-1 truncate text-sm text-brand-text-muted">{restaurant.name}</p>
          ) : null}
        </div>

        <nav
          className={`min-h-0 flex-1 space-y-1 overflow-y-auto py-4 ${showRail ? 'px-2' : 'px-4'}`}
        >
          {navItems.map((item) => (
            <DashboardNavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={t[item.key]}
              active={isNavItemActive(item)}
              collapsed={showRail}
              onNavigate={handleGo}
              badgeCount={item.checkoutBadge ? checkoutRequestCount : 0}
            />
          ))}
          {showKitchenShortcut ? (
            <DashboardNavLink
              href={`/${restaurant.slug}/kitchen`}
              icon="🍳"
              label={t.viewKitchen}
              active={false}
              collapsed={showRail}
              external
            />
          ) : null}
        </nav>

        <DashboardNavFooter
          logoutLabel={t.logout}
          onLogout={requestSignOut}
          collapsed={showRail}
        />
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
