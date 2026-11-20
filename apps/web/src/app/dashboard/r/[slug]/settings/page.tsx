import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/dashboard/SettingsForm';
import { SettingsHubEmpty } from '@/components/dashboard/settings/SettingsHubEmpty';
import type { PermissionKey } from '@/lib/permissions/registry';
import { requirePermission } from '@/lib/permissions/require';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { dashboardStoreHref } from '@/lib/dashboard-store-routes';
import {
  requireRestaurantForSettingsPermission,
  toSettingsProfile,
} from '@/lib/settings-page-data';
import { resolveSettingsHubDestination } from '@/lib/settings-nav';

/**
 * Settings hub: entry is `dashboard.settings.view`.
 * Destination: profile | first child tab | empty — sole decision in resolveSettingsHubDestination.
 */
export default async function SettingsPage({ params }: { params: { slug: string } }) {
  const store = await requireDashboardStore(params.slug);
  const entry: PermissionKey = 'dashboard.settings.view';
  const auth = await requirePermission(entry, store.restaurant.id);
  if (auth instanceof NextResponse) redirect(dashboardStoreHref(params.slug));

  const dest = resolveSettingsHubDestination(auth.capabilities);
  if (dest.kind === 'redirect') redirect(dashboardStoreHref(params.slug, dest.page));
  if (dest.kind === 'empty') return <SettingsHubEmpty />;

  const restaurant = await requireRestaurantForSettingsPermission(
    'settings.profile.manage',
    store.restaurant.id,
  );
  return (
    <SettingsForm
      embedded
      restaurant={toSettingsProfile(restaurant)}
      isOwner={auth.principal.kind === 'owner'}
    />
  );
}
