import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KitchenScreenBoard } from '@/components/kitchen/KitchenScreenBoard';
import { requireStaffSlugPagePermission } from '@/lib/staff-page-gate';
import { loadKitchenBoardInitial } from '@/lib/staff-board';
import { createAdminClient } from '@/lib/supabase/admin';
import { listKitchenScreens } from '@/lib/kitchen-screens-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import type { KitchenScreen, PrintStation } from '@/types';

interface Props {
  params: Promise<{ slug: string; screenId: string }>;
}

export default async function KitchenScreenPage({ params }: Props) {
  const { slug, screenId: screenIdRaw } = await params;
  const screenId = parseTableIdParam(screenIdRaw);
  if (!screenId) notFound();

  const supabase = await createClient();
  const access = await requireStaffSlugPagePermission(slug, 'floor.kitchen_board.view');

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  let feature_flags: Record<string, unknown> | null = null;
  let screen: KitchenScreen | null = null;
  let stations: PrintStation[] = [];

  try {
    const admin = createAdminClient();
    const [{ data: flagsRow }, listed, { data: stationRows }, board] = await Promise.all([
      admin
        .from('restaurants')
        .select('feature_flags')
        .eq('id', access.restaurant_id)
        .maybeSingle(),
      listKitchenScreens(admin, access.restaurant_id),
      admin
        .from('print_stations')
        .select('id, restaurant_id, name_pt, name_en, name_zh, sort_order, created_at, kitchen_enabled')
        .eq('restaurant_id', access.restaurant_id)
        .eq('kitchen_enabled', true),
      loadKitchenBoardInitial(access.restaurant_id).catch(() => null),
    ]);

    feature_flags = (flagsRow?.feature_flags as Record<string, unknown> | null) ?? null;
    stations = (stationRows || []) as PrintStation[];

    if (Array.isArray(listed)) {
      const found = listed.find((s) => s.id === screenId);
      if (found) {
        screen = {
          id: found.id,
          restaurant_id: found.restaurant_id,
          name: found.name,
          sort_order: found.sort_order,
          created_at: found.created_at,
          updated_at: found.updated_at,
          station_ids: found.station_ids,
        };
      }
    }

    if (!screen) notFound();

    return (
      <KitchenScreenBoard
        restaurant={{ ...restaurant, feature_flags }}
        asOwner={access.as_owner}
        screen={screen}
        stations={stations}
        initialOrders={board?.orders}
        initialReadyAfterMinutes={board?.kitchen_ready_after_minutes}
      />
    );
  } catch {
    notFound();
  }
}
