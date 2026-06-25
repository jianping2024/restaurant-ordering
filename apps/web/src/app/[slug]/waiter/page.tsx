import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { staffAuthForPage } from '@/lib/staff-api-auth';
import { loadWaiterBoardInitial } from '@/lib/staff-board';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WaiterPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const auth = await staffAuthForPage(slug, 'waiter');
  const board = auth
    ? await loadWaiterBoardInitial(auth.restaurant_id).catch(() => null)
    : null;

  return (
    <WaiterDisplay
      restaurant={restaurant}
      tables={board?.tables}
      initialOrders={board?.orders}
      initialCheckoutRequestedTableIds={board?.checkoutRequestedTableIds}
      initialSessionMetaByTableId={board?.sessionMetaByTableId}
      initialCheckoutRequestedAtByTableId={board?.checkoutRequestedAtByTableId}
      initialGroups={board?.groups}
      initialMembers={board?.members}
    />
  );
}
