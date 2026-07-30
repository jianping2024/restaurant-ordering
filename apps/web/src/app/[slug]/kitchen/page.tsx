import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KitchenDisplay } from '@/components/kitchen/KitchenDisplay';
import { requireStaffSlugPagePermission } from '@/lib/staff-page-gate';
import { loadKitchenBoardInitial } from '@/lib/staff-board';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { createAdminClient } from '@/lib/supabase/admin';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function KitchenPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const access = await requireStaffSlugPagePermission(slug, 'floor.kitchen_board.view');

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  let feature_flags: Record<string, unknown> | null = null;
  try {
    const admin = createAdminClient();
    const { data: flagsRow } = await admin
      .from('restaurants')
      .select('feature_flags')
      .eq('id', access.restaurant_id)
      .maybeSingle();
    feature_flags = (flagsRow?.feature_flags as Record<string, unknown> | null) ?? null;
  } catch {
    feature_flags = null;
  }

  const board = await loadKitchenBoardInitial(access.restaurant_id).catch(() => null);
  const principalCaps = await loadPrincipalWithCapabilities();
  const capabilities = toCapabilitiesPayload(principalCaps?.capabilities ?? new Set());

  return (
    <KitchenDisplay
      restaurant={{ ...restaurant, feature_flags }}
      capabilities={capabilities}
      asOwner={access.as_owner}
      hasAuthoritativeSeed={board != null}
      initialOrders={board?.orders}
      initialActiveTableIds={board?.activeTableIds}
      initialTables={board?.tables}
    />
  );
}
