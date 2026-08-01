import { DashboardSettingsShell } from '@/components/dashboard/DashboardSettingsShell';
import { canAccessSystemLogs } from '@/lib/system-logs/access';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { getWebAppBuildInfo } from '@/lib/web-app-build';

export const dynamic = 'force-dynamic';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const loaded = await loadPrincipalWithCapabilities();
  const capabilities = toCapabilitiesPayload(loaded?.capabilities ?? new Set());
  const showSystemLogs = canAccessSystemLogs(loaded?.principal);
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
