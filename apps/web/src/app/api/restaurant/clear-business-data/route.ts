import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import { clearRestaurantBusinessData } from '@/lib/clear-restaurant-business-data';

export const runtime = 'nodejs';

/**
 * Owner-only pre-delivery wipe of runtime/test business data (+ fiscal hang-queue).
 * Body: { confirmSlug: string, confirmPhrase: string }
 * confirmPhrase must equal the restaurant slug a second time (二次确认).
 */
export async function POST(req: Request) {
  const loaded = await loadPrincipalWithCapabilities();
  if (!loaded) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (loaded.principal.kind !== 'owner') {
    return NextResponse.json({ error: 'owner_only' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const confirmSlug =
    typeof body.confirmSlug === 'string' ? body.confirmSlug.trim().toLowerCase() : '';
  const confirmPhrase =
    typeof body.confirmPhrase === 'string' ? body.confirmPhrase.trim().toLowerCase() : '';
  if (!confirmSlug || !confirmPhrase) {
    return NextResponse.json({ error: 'confirm_required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const restaurantId = loaded.principal.restaurantId;

  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('id', restaurantId)
    .maybeSingle();

  if (fetchError || !restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const slug = String(restaurant.slug).toLowerCase();
  if (confirmSlug !== slug || confirmPhrase !== slug) {
    return NextResponse.json({ error: 'slug_mismatch' }, { status: 409 });
  }

  const result = await clearRestaurantBusinessData({
    admin,
    restaurantId,
    actorUserId: loaded.principal.userId,
  });

  if (!result.ok) {
    const status =
      result.error === 'fiscal_clear_timeout'
        ? 504
        : result.error === 'fiscal_clear_failed' || result.error === 'fiscal_clear_enqueue_failed'
          ? 502
          : 500;
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    restaurantId: result.restaurantId,
    fiscal: result.fiscal,
  });
}
