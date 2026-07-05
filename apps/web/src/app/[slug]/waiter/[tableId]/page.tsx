import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { requireStaffSlugPageAccess } from '@/lib/staff-page-gate';
import { loadWaiterTablePageInitial } from '@/lib/waiter-table-detail-load';

interface Props {
  params: Promise<{ slug: string; tableId: string }>;
}

export default async function WaiterTablePage({ params }: Props) {
  const { slug, tableId: tableIdParam } = await params;
  const tableId = parseTableIdParam(tableIdParam);
  if (!tableId) notFound();

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const access = await requireStaffSlugPageAccess(slug, ['waiter']);

  const initialModel = await loadWaiterTablePageInitial(restaurant.id, tableId);
  if (!initialModel?.detail.table) notFound();

  return (
    <WaiterTableDetail
      restaurant={restaurant}
      asOwner={access.as_owner}
      hasAuthoritativeSeed
      initialModel={initialModel}
      tableId={tableId}
    />
  );
}
