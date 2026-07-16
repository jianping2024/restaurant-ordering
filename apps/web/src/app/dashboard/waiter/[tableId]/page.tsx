import { notFound } from 'next/navigation';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import { requireWaiterBoardDashboardAccess } from '@/lib/dashboard-page-access';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { loadWaiterTablePageInitial } from '@/lib/waiter-table-detail-load';

interface Props {
  params: Promise<{ tableId: string }>;
}

export default async function DashboardWaiterTablePage({ params }: Props) {
  const { restaurant, mode: floorStaffRole } = await requireWaiterBoardDashboardAccess();

  const { tableId: tableIdParam } = await params;
  const tableId = parseTableIdParam(tableIdParam);
  if (!tableId) notFound();

  const initialModel = await loadWaiterTablePageInitial(restaurant.id, tableId);
  if (!initialModel?.detail.table) notFound();

  return (
    <WaiterTableDetail
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
      hasAuthoritativeSeed
      initialModel={initialModel}
      tableId={tableId}
      embeddedInDashboard
      floorStaffRole={floorStaffRole}
    />
  );
}
