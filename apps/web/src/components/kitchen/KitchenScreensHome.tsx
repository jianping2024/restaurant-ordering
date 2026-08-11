'use client';

import Link from 'next/link';
import type { KitchenScreen } from '@/types';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { StaffAuthenticatedShell, type StaffShellContext } from '@/components/staff/StaffAuthenticatedShell';
import { PersonalSettingsMenu } from '@/components/staff/PersonalSettingsMenu';
import { StaffPersonalTopBar } from '@/components/staff/StaffPersonalTopBar';
import {
  buildDashboardTopNavItems,
  dashboardLogoHref,
} from '@/lib/dashboard-top-nav';
import type { CapabilitiesPayload } from '@/lib/permissions/can';
import { topBarRoleLabel } from '@/lib/top-bar-role-label';
import { KITCHEN_SCREEN_TEXT } from '@/components/kitchen/kitchen-screen-labels';

type Props = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    feature_flags?: Record<string, unknown> | null;
  };
  capabilities: CapabilitiesPayload;
  asOwner?: boolean;
  screens: KitchenScreen[];
};

export function KitchenScreensHome(props: Props) {
  return (
    <StaffAuthenticatedShell
      restaurant={props.restaurant}
      expectedRole="kitchen"
      asOwner={props.asOwner}
    >
      {(ctx) => <KitchenScreensHomeInner {...props} {...ctx} />}
    </StaffAuthenticatedShell>
  );
}

function KitchenScreensHomeInner({
  restaurant,
  capabilities,
  asOwner = false,
  screens,
  handleSignOut,
  exitLabel,
  confirmBeforeSignOut,
}: Props & StaffShellContext) {
  const { lang } = useLanguage();
  const t = KITCHEN_SCREEN_TEXT[lang];
  const roleLabel = topBarRoleLabel(lang, asOwner ? 'backend_admin' : 'kitchen');

  const navItems = buildDashboardTopNavItems({
    shellMode: 'staff',
    capabilities,
    restaurantSlug: restaurant.slug,
  });
  const logoHref = dashboardLogoHref(restaurant.slug, capabilities);

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
      <StaffPersonalTopBar
        logoHref={logoHref}
        restaurantName={restaurant.name}
        navItems={navItems}
        settingsMenu={
          <PersonalSettingsMenu
            roleLabel={roleLabel}
            logoutLabel={exitLabel}
            onSignOut={() => void handleSignOut()}
            confirmSignOut={confirmBeforeSignOut}
            compact
            allowChangePassword
          />
        }
      />
      <div className="min-h-0 flex-1 p-4">
        <h1 className="font-heading text-3xl text-brand-ink mb-6">{t.screensTitle}</h1>
        {screens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-brand-border bg-brand-card px-6 py-16 text-center">
            <p className="text-lg text-brand-text">{t.screensEmpty}</p>
            <p className="mt-2 text-sm text-brand-text-muted">{t.screensEmptyHint}</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {screens.map((screen) => (
              <li key={screen.id}>
                <Link
                  href={`/${restaurant.slug}/kitchen/${screen.id}`}
                  className="block rounded-2xl border border-brand-border bg-brand-card px-4 py-5 hover:border-brand-gold/50 transition-colors"
                >
                  <p className="font-heading text-xl text-brand-text">{screen.name}</p>
                  <p className="mt-1 text-[12px] text-brand-text-muted">
                    {screen.station_ids.length} station
                    {screen.station_ids.length === 1 ? '' : 's'}
                  </p>
                  <span className="mt-3 inline-block text-sm text-brand-ink">{t.openScreen} →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
