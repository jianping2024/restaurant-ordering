import { redirect } from 'next/navigation';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { loadWaiterBoardInitial } from '@/lib/staff-board';

export default async function DashboardWaiterPage() {
  const access = await loadDashboardAccess();
  if (access.mode !== 'owner') {
    redirect('/dashboard');
  }

  const { restaurant } = access;
  let board;
  try {
    board = await loadWaiterBoardInitial(restaurant.id);
  } catch {
    board = null;
  }

  return (
    <WaiterDisplay
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
      embeddedInDashboard
      tables={board?.tables}
      initialOrders={board?.orders}
      initialCheckoutRequestedTableIds={board?.checkoutRequestedTableIds}
      initialSessionMetaByTableId={board?.sessionMetaByTableId}
      initialCheckoutRequestedAtByTableId={board?.checkoutRequestedAtByTableId}
      initialGroups={board?.groups}
      initialMembers={board?.members}
    />
  );
}
