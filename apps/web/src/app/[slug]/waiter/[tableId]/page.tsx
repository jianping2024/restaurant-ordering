import { permanentRedirect } from 'next/navigation';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string; tableId: string }>;
}

/** Legacy slug waiter table → Dashboard table detail. */
export default async function WaiterTablePageRedirect({ params }: Props) {
  const { tableId: tableIdParam } = await params;
  const tableId = parseTableIdParam(tableIdParam);
  if (!tableId) notFound();
  permanentRedirect(`/dashboard/waiter/${encodeURIComponent(tableId)}`);
}
