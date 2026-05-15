import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import type { Buffet } from '@/types';

interface Props {
  params: Promise<{ slug: string; table: string }>;
}

export default async function WaiterTablePage({ params }: Props) {
  const { slug, table } = await params;
  const tableNum = Number(table);
  if (!Number.isInteger(tableNum) || tableNum < 1 || tableNum > 30) notFound();

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const { data: buffetRows } = await supabase
    .from('buffets')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('name');

  return (
    <WaiterTableDetail
      restaurant={restaurant}
      initialBuffets={(buffetRows || []) as Buffet[]}
      tableNumber={tableNum}
    />
  );
}
