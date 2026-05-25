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
    .from('restaurants_public')
    .select('id, name, slug, table_numbers')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  return <WaiterDisplay restaurant={restaurant} />;
}
