import { NextResponse } from 'next/server';
import { requireRestaurantPrincipal } from '@/lib/permissions/require';
import { requireStoreRestaurantId } from '@/lib/restaurant-api-store';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

/**
 * Store-picker favorite (multi-store plan §8.1): `PUT` stars / `DELETE` unstars this store
 * for the signed-in staff account. Writes only the caller's own membership row in this
 * store (`favorited_at`); UX only, never auth. The admin account has no membership → 409.
 */
async function setFavorite(slug: string, favorite: boolean): Promise<Response> {
  const storeId = await requireStoreRestaurantId(slug);
  if (storeId instanceof NextResponse) return storeId;
  const access = await requireRestaurantPrincipal(storeId);
  if (access instanceof NextResponse) return access;
  if (access.principal.kind !== 'staff') {
    return NextResponse.json({ error: 'not_a_member' }, { status: 409 });
  }

  const favoritedAt = favorite ? new Date().toISOString() : null;
  const { error } = await createAdminClient()
    .from('restaurant_staff_accounts')
    .update({ favorited_at: favoritedAt })
    .eq('id', access.principal.staffAccountId)
    .eq('restaurant_id', access.restaurantId)
    .eq('user_id', access.principal.userId);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true, favorited_at: favoritedAt });
}

export async function PUT(_req: Request, { params }: { params: { slug: string } }) {
  return setFavorite(params.slug, true);
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  return setFavorite(params.slug, false);
}
