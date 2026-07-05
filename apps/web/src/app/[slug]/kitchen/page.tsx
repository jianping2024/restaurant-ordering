import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KitchenDisplay } from '@/components/kitchen/KitchenDisplay';
import { requireStaffSlugPageAccess } from '@/lib/staff-page-gate';
import { loadKitchenBoardInitial } from '@/lib/staff-board';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function KitchenPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const access = await requireStaffSlugPageAccess(slug, ['kitchen']);
  const board = await loadKitchenBoardInitial(access.restaurant_id).catch(() => null);

  return (
    <KitchenDisplay
      restaurant={restaurant}
      asOwner={access.as_owner}
      hasAuthoritativeSeed={board != null}
      initialOrders={board?.orders}
      initialActiveTableIds={board?.activeTableIds}
      initialTables={board?.tables}
    />
  );
}
