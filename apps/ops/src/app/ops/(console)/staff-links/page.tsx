import { getPlatformAdmin } from '@/lib/platform-auth';
import { StaffLinksClient } from './StaffLinksClient';

export default async function StaffLinksPage() {
  const admin = await getPlatformAdmin();
  return <StaffLinksClient canManage={admin?.account.role === 'admin'} />;
}
