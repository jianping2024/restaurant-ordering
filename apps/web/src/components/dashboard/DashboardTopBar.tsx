'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { DashboardAccessMode, DashboardNavRestaurant } from '@/lib/dashboard-access';
import { isDashboardKitchenShortcutEnabled } from '@/lib/restaurant-features';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { PersonalSettingsMenu } from '@/components/staff/PersonalSettingsMenu';
import { StaffPersonalTopBar } from '@/components/staff/StaffPersonalTopBar';
import {
  buildDashboardTopNavItems,
  dashboardLogoHref,
} from '@/lib/dashboard-top-nav';
import { topBarRoleLabel } from '@/lib/top-bar-role-label';
import type { CapabilitiesPayload } from '@/lib/permissions/can';

type TopBarPanel = 'none' | 'nav' | 'settings';

type Props = {
  restaurant: DashboardNavRestaurant;
  accessMode: DashboardAccessMode;
  capabilities: CapabilitiesPayload;
};

export function DashboardTopBar({ restaurant, accessMode, capabilities }: Props) {
  const { lang } = useLanguage();
  const navT = getMessages(lang).nav;
  const { pendingCount } = useCheckoutRequests();
  const kitchenShortcutEnabled = isDashboardKitchenShortcutEnabled(restaurant.feature_flags);
  const navItems = buildDashboardTopNavItems({
    accessMode,
    capabilities,
    restaurantSlug: restaurant.slug,
    kitchenShortcutEnabled,
  });
  const [openPanel, setOpenPanel] = useState<TopBarPanel>('none');

  const roleLabel = topBarRoleLabel(lang, accessMode);
  const logoHref = dashboardLogoHref(accessMode);

  return (
    <StaffPersonalTopBar
      logoHref={logoHref}
      restaurantName={restaurant.name}
      navItems={navItems}
      navOpen={openPanel === 'nav'}
      onNavOpenChange={(open) => setOpenPanel(open ? 'nav' : 'none')}
      checkoutCount={pendingCount}
      prefetch
      onNavigate={() => setOpenPanel('none')}
      settingsMenu={
        <PersonalSettingsMenu
          roleLabel={roleLabel}
          logoutLabel={navT.logout}
          compact
          open={openPanel === 'settings'}
          onOpenChange={(open) => setOpenPanel(open ? 'settings' : 'none')}
          onSignOut={() => void dashboardSignOutAndRedirect()}
        />
      }
    />
  );
}
