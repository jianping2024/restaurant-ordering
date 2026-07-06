'use client';

import type { ReactNode } from 'react';
import { StaffPersonalSettingsMenu } from '@/components/staff/StaffPersonalSettingsMenu';
import { StaffPersonalTopBar } from '@/components/staff/StaffPersonalTopBar';
import { WaiterAuthenticatedShell } from '@/components/waiter/WaiterAuthenticatedShell';
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
  const navItems = buildWaiterStandaloneTopNav(restaurant.slug);

  return (
    <WaiterAuthenticatedShell restaurant={restaurant} asOwner={asOwner}>
      {({ handleSignOut, exitLabel, confirmBeforeSignOut }) => (
        <div className="flex min-h-screen flex-col bg-brand-bg">
          <StaffPersonalTopBar
            logoHref={waiterStandaloneLogoHref(restaurant.slug)}
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
          <main className="min-h-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      )}
    </WaiterAuthenticatedShell>
  );
}
