import { notFound, redirect } from 'next/navigation';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import { loadDashboardAccess } from '@/lib/dashboard-access';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { createClient } from '@/lib/supabase/server';
import type { Buffet } from '@/types';

interface Props {
  params: Promise<{ tableId: string }>;
}

export default async function DashboardWaiterTablePage({ params }: Props) {
  const access = await loadDashboardAccess();
  if (access.mode !== 'frontdesk') {
    redirect('/dashboard');
  }

  const { tableId: tableIdParam } = await params;
  const tableId = parseTableIdParam(tableIdParam);
  if (!tableId) notFound();

  const { restaurant } = access;
  const supabase = await createClient();

  const { data: buffetRows } = await supabase
    .from('buffets')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('name');

  return (
    <WaiterTableDetail
      restaurant={{ id: restaurant.id, name: restaurant.name, slug: restaurant.slug }}
      initialBuffets={(buffetRows || []) as Buffet[]}
      tableId={tableId}
      embeddedInDashboard
    />
  );
}
