import { DashboardSettingsShell } from '@/components/dashboard/DashboardSettingsShell';
import { canAccessSystemLogs } from '@/lib/system-logs/access';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { getWebAppBuildInfo } from '@/lib/web-app-build';

export const dynamic = 'force-dynamic';

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const { loaded } = await requireDashboardStore(params.slug);
  const capabilities = toCapabilitiesPayload(loaded.capabilities);
  const showSystemLogs = canAccessSystemLogs(loaded.principal);
  const { version: webAppVersion } = getWebAppBuildInfo();

  return (
    <DashboardSettingsShell
      capabilities={capabilities}
      showSystemLogs={showSystemLogs}
      webAppVersion={webAppVersion}
    >
      {children}
    </DashboardSettingsShell>
  );
}
