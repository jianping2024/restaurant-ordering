import { redirect } from 'next/navigation';
import { getPlatformAdmin } from '@/lib/platform-auth';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdmin();
  if (!admin) {
    redirect('/ops/login');
  }
  if (admin.account.role !== 'admin') {
    redirect('/ops');
  }

  return children;
}
