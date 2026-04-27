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

  const [{ data: orders }, { data: sessions }] = await Promise.all([
    supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['pending', 'cooking'])
      .order('created_at', { ascending: true }),
    supabase
      .from('table_sessions')
      .select('table_number')
      .eq('restaurant_id', restaurant.id)
      .in('status', ['open', 'billing']),
  ]);

  const initialActiveTables = Array.from(
    new Set((sessions || []).map((s) => s.table_number)),
  ).sort((a, b) => a - b);

  return (
    <KitchenDisplay
      restaurant={restaurant}
      initialOrders={orders || []}
      initialActiveTables={initialActiveTables}
    />
  );
}
