import { DashboardSettingsShell } from '@/components/dashboard/DashboardSettingsShell';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <DashboardSettingsShell>{children}</DashboardSettingsShell>;
}
