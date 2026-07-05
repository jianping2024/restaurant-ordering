'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { dashboardNavCheckoutBadgeClassName } from '@/components/dashboard/dashboard-nav-link';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { defaultDashboardNavOpen, isDashboardNavDocked } from '@/lib/dashboard-nav-config';
import {
  loadDashboardNavOpen,
  saveDashboardNavOpen,
} from '@/lib/dashboard-nav-preference';
import { getMessages } from '@/lib/i18n/messages';

const LG_MEDIA = '(min-width: 1024px)';

function useLargeScreen(): boolean {
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(LG_MEDIA);
    const sync = () => setIsLarge(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isLarge;
}

type DashboardShellProps = {
  restaurant: DashboardNavRestaurant;
  accessMode: DashboardAccessMode;
  children: React.ReactNode;
};

export function DashboardShell({ restaurant, accessMode, children }: DashboardShellProps) {
  const { lang } = useLanguage();
  const t = getMessages(lang).nav;
  const isLargeScreen = useLargeScreen();
  const { pendingCount: checkoutRequestCount } = useCheckoutRequests();
  const [navOpen, setNavOpen] = useState(() => defaultDashboardNavOpen(accessMode));
  const [preferenceHydrated, setPreferenceHydrated] = useState(false);

  useLayoutEffect(() => {
    const saved = loadDashboardNavOpen(restaurant.id, accessMode);
    if (saved !== null) {
      setNavOpen(saved);
    }
    setPreferenceHydrated(true);
  }, [restaurant.id, accessMode]);

  const setNavOpenPersisted = useCallback(
    (open: boolean) => {
      setNavOpen(open);
      saveDashboardNavOpen(restaurant.id, accessMode, open);
    },
    [restaurant.id, accessMode],
  );

  const docked = preferenceHydrated && isDashboardNavDocked(accessMode, navOpen, isLargeScreen);
  const drawerOpen = navOpen && !docked;
  const showMenuButton = !docked;

  const openNav = () => setNavOpenPersisted(true);
  const closeNav = () => setNavOpenPersisted(false);

  const handleNavigate = docked ? () => {} : closeNav;

  return (
    <div className="flex min-h-screen bg-brand-bg">
      {docked ? (
        <DashboardNav
          restaurant={restaurant}
          accessMode={accessMode}
          variant="docked"
          onNavigate={handleNavigate}
        />
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-brand-border bg-brand-card px-4">
          {showMenuButton ? (
            <button
              type="button"
              onClick={openNav}
              className="relative h-9 w-9 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text"
              aria-label={t.openMenu}
            >
              ☰
              {checkoutRequestCount > 0 ? (
                <span
                  className={`${dashboardNavCheckoutBadgeClassName} right-0 top-0 translate-y-0`}
                  aria-hidden
                >
                  {checkoutRequestCount > 99 ? '99+' : checkoutRequestCount}
                </span>
              ) : null}
            </button>
          ) : (
            <button
              type="button"
              onClick={closeNav}
              className="h-9 w-9 rounded-lg border border-brand-border text-brand-text-muted hover:text-brand-text"
              aria-label={t.closeMenu}
            >
              ☰
            </button>
          )}
          <ProductLogo size="md" />
          <div className="h-9 w-9" aria-hidden />
        </header>

        <main className="min-h-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      {drawerOpen ? (
        <>
          <button
            type="button"
            aria-label={t.closeMenu}
            onClick={closeNav}
            className="fixed inset-0 z-40 bg-black/40"
          />
          <DashboardNav
            restaurant={restaurant}
            accessMode={accessMode}
            variant="drawer"
            onNavigate={handleNavigate}
            onClose={closeNav}
          />
        </>
      ) : null}
    </div>
  );
}
