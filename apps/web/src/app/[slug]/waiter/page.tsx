import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { requireStaffSlugPageAccess } from '@/lib/staff-page-gate';
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

  const access = await requireStaffSlugPageAccess(slug, ['waiter']);
  const board = await loadWaiterBoardInitial(access.restaurant_id).catch(() => null);

  return (
    <WaiterDisplay
      restaurant={restaurant}
      asOwner={access.as_owner}
      hasAuthoritativeSeed={board != null}
      tables={board?.tables}
      initialTableSummaries={board?.tableSummaries}
      initialCheckoutRequestedTableIds={board?.checkoutRequestedTableIds}
      initialSessionMetaByTableId={board?.sessionMetaByTableId}
      initialCheckoutRequestedAtByTableId={board?.checkoutRequestedAtByTableId}
      initialGroups={board?.groups}
      initialMembers={board?.members}
    />
  );
}
