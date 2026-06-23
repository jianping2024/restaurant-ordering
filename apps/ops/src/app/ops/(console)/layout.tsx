import { redirect } from 'next/navigation';
import { OpsShell } from '@/components/OpsShell';
import { getPlatformAdmin } from '@/lib/platform-auth';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdmin();
  if (!admin) {
    redirect('/ops/login');
  }

  return <OpsShell displayName={admin.account.display_name}>{children}</OpsShell>;
}
