import { redirect } from 'next/navigation';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { loadDashboardAccess } from '@/lib/dashboard-access';

export default async function DashboardWaiterPage() {
  const access = await loadDashboardAccess();
  if (access.mode !== 'owner') {
    redirect('/dashboard');
  }

  const { restaurant } = access;
  return (
    <WaiterDisplay
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
      embeddedInDashboard
    />
  );
}
