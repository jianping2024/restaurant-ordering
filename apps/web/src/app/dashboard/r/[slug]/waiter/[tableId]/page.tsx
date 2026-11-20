import { notFound } from 'next/navigation';
import { parseTableIdParam } from '@/lib/restaurant-tables';

interface Props {
  params: Promise<{ tableId: string }>;
}

/**
 * Thin route slot — detail UI is hosted by DashboardWaiterFloorShell.
 * Auth runs once in dashboard/waiter/layout; this page only validates table_id shape.
 */
export default async function DashboardWaiterTablePage({ params }: Props) {
  const { tableId: tableIdParam } = await params;
  if (!parseTableIdParam(tableIdParam)) notFound();

  return null;
}
