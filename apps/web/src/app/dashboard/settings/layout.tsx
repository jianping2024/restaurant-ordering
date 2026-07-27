import { DashboardSettingsShell } from '@/components/dashboard/DashboardSettingsShell';

export const dynamic = 'force-dynamic';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardSettingsShell>{children}</DashboardSettingsShell>;
}
