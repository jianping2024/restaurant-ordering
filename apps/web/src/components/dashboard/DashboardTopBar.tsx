'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { isDashboardKitchenShortcutEnabled } from '@/lib/restaurant-features';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { DashboardSettingsMenu } from '@/components/dashboard/DashboardSettingsMenu';
import { ProductTopBarBrand, ProductTopBarTrailing } from '@/components/ui/ProductTopBarChrome';
import { ProductTopBarMenu } from '@/components/ui/ProductTopBarMenu';
import {
  buildDashboardTopNavItems,
  dashboardLogoHref,
  staffTopBarNavSurface,
} from '@/lib/dashboard-top-nav';
import { staffTopBarChrome } from '@/lib/waiter-staff-sticky-chrome';
import { topBarRoleLabel } from '@/lib/top-bar-role-label';

type TopBarPanel = 'none' | 'nav' | 'settings';

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
  const [openPanel, setOpenPanel] = useState<TopBarPanel>('none');

  const closePanels = () => setOpenPanel('none');
  const roleLabel = topBarRoleLabel(lang, accessMode);
  const logoHref = dashboardLogoHref(accessMode);

  return (
    <header className={staffTopBarChrome.headerClassName}>
      <div className={staffTopBarChrome.rowClassName}>
        <div className={staffTopBarChrome.leadingClassName}>
          <ProductTopBarBrand href={logoHref} restaurantName={restaurant.name} />

          <ProductTopBarMenu
            items={navItems}
            pathname={pathname}
            navT={navT}
            navSurface={staffTopBarNavSurface(accessMode)}
            checkoutCount={pendingCount}
            prefetch
            open={openPanel === 'nav'}
            onOpenChange={(open) => setOpenPanel(open ? 'nav' : 'none')}
            onNavigate={closePanels}
          />
        </div>

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
