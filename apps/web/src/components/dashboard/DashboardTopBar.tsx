'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import type { DashboardNavRestaurant, DashboardShellMode } from '@/lib/dashboard-access';
import { isDashboardKitchenShortcutEnabled } from '@/lib/restaurant-features';
import { useCheckoutRequests } from '@/components/dashboard/CheckoutRequestsProvider';
import { dashboardSignOutAndRedirect } from '@/lib/auth/sign-out-client';
import { PersonalSettingsMenu } from '@/components/staff/PersonalSettingsMenu';
import { StaffPersonalTopBar } from '@/components/staff/StaffPersonalTopBar';
import {
  buildDashboardTopNavItems,
  dashboardLogoHref,
} from '@/lib/dashboard-top-nav';
import { dashboardShellRoleLabel } from '@/lib/top-bar-role-label';
import type { CapabilitiesPayload } from '@/lib/permissions/can';

type TopBarPanel = 'none' | 'nav' | 'settings';

type Props = {
  restaurant: DashboardNavRestaurant;
  shellMode: DashboardShellMode;
  roleLabel?: string;
  capabilities: CapabilitiesPayload;
};

export function DashboardTopBar({ restaurant, shellMode, roleLabel, capabilities }: Props) {
  const { lang } = useLanguage();
  const navT = getMessages(lang).nav;
  const { pendingCount } = useCheckoutRequests();
  const kitchenShortcutEnabled = isDashboardKitchenShortcutEnabled(restaurant.feature_flags);
  const navItems = buildDashboardTopNavItems({
    shellMode,
    capabilities,
    restaurantSlug: restaurant.slug,
    kitchenShortcutEnabled,
  });
  const [openPanel, setOpenPanel] = useState<TopBarPanel>('none');

  const label = dashboardShellRoleLabel(lang, shellMode, roleLabel);
  const logoHref = dashboardLogoHref(restaurant.slug, capabilities);

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
          roleLabel={label}
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
