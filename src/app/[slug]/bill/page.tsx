import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BillPage } from '@/components/menu/BillPage';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}

export default async function BillRoute({ params, searchParams }: Props) {
  const { slug } = await params;
  const { table } = await searchParams;
  const tableNumber = parseInt(table || '1', 10) || 1;

  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  // 查询该桌订单。账单页会按“菜品级 done 状态”过滤可结算菜品。
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', tableNumber)
    .order('created_at', { ascending: true });

  return (
    <BillPage
      restaurant={restaurant}
      tableNumber={tableNumber}
      orders={orders || []}
    />
  );
}
