'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { useSignOutConfirmState, SignOutConfirmModal } from '@/lib/auth/sign-out-confirm';
import { createClient } from '@/lib/supabase/client';
import type { Restaurant } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { DashboardNavFooter } from '@/components/dashboard/DashboardNavFooter';
import { getMessages } from '@/lib/i18n/messages';
import { ProductLogo } from '@/components/ui/ProductLogo';
import type { DashboardAccessMode } from '@/lib/dashboard-access';
import { navItemsForRole } from '@/lib/dashboard-feature-registry';
import { isDashboardKitchenShortcutEnabled } from '@/lib/restaurant-features';
import { dashboardNavLinkClassName } from '@/components/dashboard/dashboard-nav-link';

const ownerNavItems = navItemsForRole('owner');
const frontdeskNavItems = navItemsForRole('frontdesk');
const cashierNavItems = navItemsForRole('cashier');

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

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-40 h-16 bg-brand-card border-b border-brand-border px-4 flex items-center justify-between">
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

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
        />
      )}

      {/* Desktop sidebar + Mobile drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-64 bg-brand-card border-r border-brand-border flex flex-col transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
      {/* Logo */}
      <div className="shrink-0 px-6 py-5 lg:py-6 border-b border-brand-border">
        <div className="flex items-center justify-between gap-2">
          <ProductLogo size="md" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden h-8 w-8 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        <p className="text-brand-text-muted text-sm mt-1 truncate">{restaurant.name}</p>
      </div>

      {/* 导航 */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const active =
            item.matchPrefix
              ? pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`)
              : item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleGo}
              className={dashboardNavLinkClassName(active)}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{t[item.key]}</span>
              {item.checkoutBadge && checkoutRequestCount > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full mesa-badge-danger px-1.5 text-[11px] font-semibold">
                  {checkoutRequestCount > 99 ? '99+' : checkoutRequestCount}
                </span>
              )}
            </Link>
          );
        })}
        {showKitchenShortcut ? (
          <a
            href={`/${restaurant.slug}/kitchen`}
            target="_blank"
            rel="noopener noreferrer"
            className={dashboardNavLinkClassName(false)}
          >
            <span className="text-lg">🍳</span>
            <span>{t.viewKitchen}</span>
          </a>
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
