import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/dashboard/SettingsForm';
import { SettingsHubEmpty } from '@/components/dashboard/settings/SettingsHubEmpty';
import type { PermissionKey } from '@/lib/permissions/registry';
import { requirePermission } from '@/lib/permissions/require';
import {
  requireRestaurantForSettingsPermission,
  toSettingsProfile,
} from '@/lib/settings-page-data';
import { resolveSettingsHubDestination } from '@/lib/settings-nav';

/**
 * Settings hub: entry is `dashboard.settings.view`.
 * Destination: profile | first child tab | empty — sole decision in resolveSettingsHubDestination.
 */
export default async function SettingsPage() {
  const entry: PermissionKey = 'dashboard.settings.view';
  const auth = await requirePermission(entry);
  if (auth instanceof NextResponse) redirect('/dashboard');

  const dest = resolveSettingsHubDestination(auth.capabilities);
  if (dest.kind === 'redirect') redirect(dest.href);
  if (dest.kind === 'empty') return <SettingsHubEmpty />;

  const restaurant = await requireRestaurantForSettingsPermission('settings.profile.manage');
  return <SettingsForm embedded restaurant={toSettingsProfile(restaurant)} />;
}
