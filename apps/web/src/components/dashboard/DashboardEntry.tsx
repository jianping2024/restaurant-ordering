import { redirect } from 'next/navigation';
import { RestaurantOnboarding } from '@/components/dashboard/RestaurantOnboarding';
import { resolveDashboardEntry } from '@/lib/dashboard-entry';
import { dashboardStoreHref, type DashboardPagePath } from '@/lib/dashboard-store-routes';
import { isOnPremInstallHost } from '@/lib/license-on-prem-host';

/**
 * Sole store-less dashboard entry: `/dashboard` (PWA start, post-login) and legacy
 * `/dashboard/*` bookmarks → same page of the account's store; else onboarding.
 */
export async function DashboardEntry({
  page,
  search,
}: {
  page: DashboardPagePath;
  search: string;
}) {
  const decision = await resolveDashboardEntry();
  if (decision.kind === 'login') redirect('/auth/login');
  if (decision.kind === 'store') redirect(`${dashboardStoreHref(decision.slug, page)}${search}`);
  // On-prem empty host: sole path is /setup claim — not free-name RestaurantOnboarding.
  if (isOnPremInstallHost()) redirect('/setup');
  return (
    <div className="min-h-screen bg-brand-bg flex">
      <RestaurantOnboarding />
    </div>
  );
}

/** `?a=b` from Next `searchParams` (empty when none). */
export function dashboardEntrySearch(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value != null) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
