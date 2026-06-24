import { getPlatformAdmin } from '@/lib/platform-auth';
import { RestaurantStaffClient } from './RestaurantStaffClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function RestaurantStaffPage({ params }: PageProps) {
  const { id } = await params;
  const admin = await getPlatformAdmin();
  const canManage = admin?.account.role === 'admin';

  return <RestaurantStaffClient restaurantId={id} canManage={canManage} />;
}
