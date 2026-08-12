import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KitchenScreensHome } from '@/components/kitchen/KitchenScreensHome';
import { requireStaffSlugPagePermission } from '@/lib/staff-page-gate';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { createAdminClient } from '@/lib/supabase/admin';
import { kitchenReadyAfterMinutesFromConfig } from '@/lib/print-agent-config';
import { listKitchenScreens } from '@/lib/kitchen-screens-server';
import type { KitchenScreen } from '@/types';

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
  let screens: KitchenScreen[] = [];
  let kitchenReadyAfterMinutes = kitchenReadyAfterMinutesFromConfig(null);
  try {
    const admin = createAdminClient();
    const [{ data: flagsRow }, listed] = await Promise.all([
      admin
        .from('restaurants')
        .select('feature_flags, print_agent_config')
        .eq('id', access.restaurant_id)
        .maybeSingle(),
      listKitchenScreens(admin, access.restaurant_id),
    ]);
    feature_flags = (flagsRow?.feature_flags as Record<string, unknown> | null) ?? null;
    kitchenReadyAfterMinutes = kitchenReadyAfterMinutesFromConfig(flagsRow?.print_agent_config);
    if (Array.isArray(listed)) {
      screens = listed.map((s) => ({
        id: s.id,
        restaurant_id: s.restaurant_id,
        name: s.name,
        sort_order: s.sort_order,
        created_at: s.created_at,
        updated_at: s.updated_at,
        station_ids: s.station_ids,
      }));
    }
  } catch {
    feature_flags = null;
    screens = [];
  }

  const principalCaps = await loadPrincipalWithCapabilities();
  const capabilities = toCapabilitiesPayload(principalCaps?.capabilities ?? new Set());

  return (
    <KitchenScreensHome
      restaurant={{ ...restaurant, feature_flags }}
      capabilities={capabilities}
      asOwner={access.as_owner}
      screens={screens}
      initialReadyAfterMinutes={kitchenReadyAfterMinutes}
    />
  );
}
