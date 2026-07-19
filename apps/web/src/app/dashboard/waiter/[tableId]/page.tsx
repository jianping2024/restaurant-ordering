import { notFound } from 'next/navigation';
import { requireWaiterBoardDashboardAccess } from '@/lib/dashboard-page-access';
import { parseTableIdParam } from '@/lib/restaurant-tables';

interface Props {
  params: Promise<{ tableId: string }>;
}

/**
 * Thin route slot — detail UI is hosted by DashboardWaiterFloorShell so table
 * switches reuse one client instance (Staff API model, not per-nav SSR).
 */
export default async function DashboardWaiterTablePage({ params }: Props) {
  await requireWaiterBoardDashboardAccess();

  const { tableId: tableIdParam } = await params;
  if (!parseTableIdParam(tableIdParam)) notFound();

  return null;
}
