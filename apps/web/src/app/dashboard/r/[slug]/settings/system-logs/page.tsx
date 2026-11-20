import { redirect } from 'next/navigation';
import { SystemLogsViewer } from '@/components/dashboard/settings/SystemLogsViewer';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { dashboardStoreHref } from '@/lib/dashboard-store-routes';
import { canAccessSystemLogs } from '@/lib/system-logs/access';

export const dynamic = 'force-dynamic';

export default async function SystemLogsSettingsPage({ params }: { params: { slug: string } }) {
  const store = await requireDashboardStore(params.slug);
  if (!canAccessSystemLogs(store.loaded.principal)) {
    redirect(dashboardStoreHref(params.slug, '/settings'));
  }

  return <SystemLogsViewer />;
}
