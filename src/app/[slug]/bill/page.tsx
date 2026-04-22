import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BillPage } from '@/components/menu/BillPage';
import type { BillSplit } from '@/types';

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

  const { data: activeSession } = await supabase
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', tableNumber)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 关台后（无 open/billing 餐次）强制回到点单页，避免客人停留在账单页。
  if (!activeSession) {
    redirect(`/${slug}/menu?table=${tableNumber}`);
  }

  // 查询当前餐次订单。账单页会按“菜品级 done 状态”过滤可结算菜品。
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .eq('table_number', tableNumber)
    .eq('session_id', activeSession.id)
    .order('created_at', { ascending: true });

  let existingSplit: BillSplit | null = null;
  const { data } = await supabase
    .from('bill_splits')
    .select('*')
    .eq('session_id', activeSession.id)
    .in('status', ['requested', 'confirmed', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  existingSplit = (data as BillSplit | null) || null;

  return (
    <BillPage
      restaurant={restaurant}
      tableNumber={tableNumber}
      orders={orders || []}
      sessionId={activeSession.id}
      existingSplit={existingSplit}
    />
  );
}
