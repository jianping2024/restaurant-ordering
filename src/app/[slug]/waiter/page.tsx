import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WaiterPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, waiter_password')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const [{ data: activeSessions }, { data: orderRows }] = await Promise.all([
    supabase
      .from('table_sessions')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['open', 'billing']),
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['pending', 'cooking', 'done'])
      .order('updated_at', { ascending: false })
      .limit(200),
  ]);

  const activeIds = new Set((activeSessions || []).map((s) => s.id));
  const orders = (orderRows || []).filter(
    (o) => !o.session_id || activeIds.has(o.session_id as string),
  );

  return (
    <WaiterDisplay
      restaurant={restaurant}
      initialOrders={orders}
    />
  );
}
