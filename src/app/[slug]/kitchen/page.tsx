import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KitchenDisplay } from '@/components/kitchen/KitchenDisplay';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function KitchenPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, kitchen_password')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  // 获取当前活跃订单（pending + cooking）
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .in('status', ['pending', 'cooking'])
    .order('created_at', { ascending: true });

  return (
    <KitchenDisplay
      restaurant={restaurant}
      initialOrders={orders || []}
    />
  );
}
