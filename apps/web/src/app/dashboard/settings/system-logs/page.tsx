import { redirect } from 'next/navigation';
import { SystemLogsViewer } from '@/components/dashboard/settings/SystemLogsViewer';
import { canAccessSystemLogs } from '@/lib/system-logs/access';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export const dynamic = 'force-dynamic';

export default async function SystemLogsSettingsPage() {
  const loaded = await loadPrincipalWithCapabilities();
  if (!canAccessSystemLogs(loaded?.principal)) {
    redirect('/dashboard/settings');
  }

  return <SystemLogsViewer />;
}
