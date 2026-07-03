import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import type { Buffet } from '@/types';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { staffAuthForPage } from '@/lib/staff-api-auth';
import { loadWaiterTableDetailInitial } from '@/lib/staff-board';

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

  await staffAuthForPage(slug, 'waiter');

  const [{ data: buffetRows }, initialDetail] = await Promise.all([
    supabase
      .from('buffets')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('name'),
    loadWaiterTableDetailInitial(restaurant.id, tableId),
  ]);

  if (!initialDetail.table) notFound();

  return (
    <WaiterTableDetail
      restaurant={restaurant}
      initialBuffets={(buffetRows || []) as Buffet[]}
      initialDetail={initialDetail}
      tableId={tableId}
    />
  );
}
