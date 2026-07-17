'use client';

import type { ReactNode } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffPersonalSettingsMenu } from '@/components/staff/StaffPersonalSettingsMenu';
import { StaffPersonalTopBar } from '@/components/staff/StaffPersonalTopBar';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
import { topBarRoleLabel } from '@/lib/top-bar-role-label';
import { STAFF_SHELL_MAIN_CLASS } from '@/lib/staff-shell-layout';
import {
  buildWaiterStandaloneTopNav,
  waiterStandaloneLogoHref,
} from '@/lib/waiter-top-nav';

type Props = {
  restaurant: { id: string; name: string; slug: string };
  asOwner?: boolean;
  children: ReactNode;
};

/** Layout shell for slug waiter routes — matches dashboard top bar pattern. */
export function WaiterStandaloneShell({ restaurant, asOwner = false, children }: Props) {
  const { lang } = useLanguage();
  const navItems = buildWaiterStandaloneTopNav(restaurant.slug);
  const roleLabel = topBarRoleLabel(lang, asOwner ? 'owner' : 'waiter');

  return (
    <WaiterAuthenticatedShell restaurant={restaurant} asOwner={asOwner}>
      {({ handleSignOut, exitLabel, confirmBeforeSignOut }) => (
        <div className="flex min-h-screen flex-col bg-brand-bg">
          <StaffPersonalTopBar
            logoHref={waiterStandaloneLogoHref(restaurant.slug)}
            restaurantName={restaurant.name}
            roleLabel={roleLabel}
            navItems={navItems}
            settingsMenu={
              <StaffPersonalSettingsMenu
                logoutLabel={exitLabel}
                onSignOut={handleSignOut}
                confirmSignOut={confirmBeforeSignOut}
                compact
              />
            }
          />
          <main className={STAFF_SHELL_MAIN_CLASS}>{children}</main>
        </div>
      )}
    </WaiterAuthenticatedShell>
  );
}
