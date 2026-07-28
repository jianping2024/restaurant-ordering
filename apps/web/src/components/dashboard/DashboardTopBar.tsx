'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { isDashboardKitchenShortcutEnabled } from '@/lib/restaurant-features';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { DashboardSettingsMenu } from '@/components/dashboard/DashboardSettingsMenu';
import { DashboardTopNavMenu } from '@/components/dashboard/DashboardTopNavMenu';
import { ProductTopBarBrand, ProductTopBarTrailing } from '@/components/ui/ProductTopBarChrome';
import { ProductTopBarNav } from '@/components/ui/ProductTopBarNav';
import {
  buildDashboardTopNavPresentation,
  dashboardLogoHref,
  isLogoHrefActive,
} from '@/lib/dashboard-top-nav';
import { staffTopBarChrome } from '@/lib/waiter-staff-sticky-chrome';
import { topBarRoleLabel } from '@/lib/top-bar-role-label';

type TopBarPanel = 'none' | 'more' | 'settings';

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
  const { items, quickActions } = buildDashboardTopNavPresentation({
    accessMode,
    restaurantSlug: restaurant.slug,
    kitchenShortcutEnabled,
  });
  const quickActionIds = new Set(quickActions.map((item) => item.id));
  const [openPanel, setOpenPanel] = useState<TopBarPanel>('none');

  const closePanels = () => setOpenPanel('none');
  const roleLabel = topBarRoleLabel(lang, accessMode);
  const logoHref = dashboardLogoHref(accessMode);
  const logoActive = isLogoHrefActive(pathname, accessMode);

  return (
    <header className={staffTopBarChrome.headerClassName}>
      <div className={staffTopBarChrome.rowClassName}>
        <ProductTopBarBrand
          href={logoHref}
          restaurantName={restaurant.name}
          logoActive={logoActive}
        />

        <ProductTopBarNav
          items={items}
          quickActions={quickActions}
          pathname={pathname}
          navT={navT}
          checkoutCount={pendingCount}
          prefetch
          onNavigate={closePanels}
        />

        <DashboardTopNavMenu
          items={items}
          quickActionIds={quickActionIds}
          accessMode={accessMode}
          pathname={pathname}
          navT={navT}
          checkoutCount={pendingCount}
          open={openPanel === 'more'}
          onOpenChange={(open) => setOpenPanel(open ? 'more' : 'none')}
        />

        <ProductTopBarTrailing>
          <DashboardSettingsMenu
            roleLabel={roleLabel}
            logoutLabel={navT.logout}
            compact
            open={openPanel === 'settings'}
            onOpenChange={(open) => setOpenPanel(open ? 'settings' : 'none')}
          />
        </ProductTopBarTrailing>
      </div>
    </header>
  );
}
