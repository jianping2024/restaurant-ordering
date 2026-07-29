import { DashboardSettingsShell } from '@/components/dashboard/DashboardSettingsShell';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import { toCapabilitiesPayload } from '@/lib/permissions/can';

export const dynamic = 'force-dynamic';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const loaded = await loadPrincipalWithCapabilities();
  const capabilities = toCapabilitiesPayload(loaded?.capabilities ?? new Set());

  return (
    <DashboardSettingsShell capabilities={capabilities}>{children}</DashboardSettingsShell>
  );
}
