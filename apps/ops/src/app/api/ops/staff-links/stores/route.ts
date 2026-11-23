import { NextResponse } from 'next/server';
import { restaurantCityFromAddress } from '@mesa/shared';
import { requirePlatformAdmin } from '@/lib/platform-auth';

/**
 * Stores the ops link screen can link an account to (cloud stores; on-prem stores keep their
 * staff in the store's own database) with their enabled roles — two queries for any count.
 */
export async function GET() {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const { data: stores, error: storesError } = await admin
    .from('restaurants')
    .select('id, name, slug, address, suspended_at')
    .eq('deployment_mode', 'cloud')
    .order('name', { ascending: true });
  if (storesError) {
    return NextResponse.json({ error: 'list_failed', detail: storesError.message }, { status: 500 });
  }

  const ids = (stores ?? []).map((s) => String(s.id));
  const { data: roles, error: rolesError } = ids.length
    ? await admin
        .from('restaurant_roles')
        .select('id, restaurant_id, name, preset_key, sort_order')
        .in('restaurant_id', ids)
        .is('disabled_at', null)
        .order('sort_order', { ascending: true })
    : { data: [], error: null };
  if (rolesError) {
    return NextResponse.json({ error: 'list_failed', detail: rolesError.message }, { status: 500 });
  }

  const rolesByStore = new Map<string, { id: string; name: string; preset_key: string | null }[]>();
  for (const r of roles ?? []) {
    const list = rolesByStore.get(String(r.restaurant_id)) ?? [];
    list.push({
      id: String(r.id),
      name: String(r.name),
      preset_key: typeof r.preset_key === 'string' ? r.preset_key : null,
    });
    rolesByStore.set(String(r.restaurant_id), list);
  }

  return NextResponse.json({
    items: (stores ?? []).map((s) => ({
      id: String(s.id),
      name: String(s.name ?? ''),
      slug: String(s.slug ?? ''),
      city: restaurantCityFromAddress(typeof s.address === 'string' ? s.address : null),
      suspended: !!s.suspended_at,
      roles: rolesByStore.get(String(s.id)) ?? [],
    })),
  });
}
