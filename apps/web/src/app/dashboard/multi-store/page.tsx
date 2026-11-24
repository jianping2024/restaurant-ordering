import { redirect } from 'next/navigation';
import { MultiStoreOverviewScreen } from '@/components/multi-store-overview/MultiStoreOverviewScreen';
import { DASHBOARD_ENTRY_PATH } from '@/lib/dashboard-store-routes';
import { loadMultiStoreOverview } from '@/lib/multi-store-overview';
import { listAuthorizedRestaurantsForUser } from '@/lib/permissions/restaurant-access';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';
import { accountHasMultiStoreEntry } from '@/lib/store-list-model';

export const dynamic = 'force-dynamic';

/**
 * Read-only multi-store overview (plan §8.4), store-less. Same gate as its entries: an account
 * that cannot enter ≥2 stores goes to the dashboard entry (→ its own store / onboarding).
 * First paint renders the sole loader; «刷新» re-reads `GET /api/multi-store/overview`.
 */
export default async function MultiStoreOverviewPage() {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) redirect('/auth/login');

  const stores = await listAuthorizedRestaurantsForUser(auth.user.id);
  if (!accountHasMultiStoreEntry(stores)) redirect(DASHBOARD_ENTRY_PATH);

  const overview = await loadMultiStoreOverview(auth.user.id);
  return <MultiStoreOverviewScreen initial={overview} stores={stores} userId={auth.user.id} />;
}
