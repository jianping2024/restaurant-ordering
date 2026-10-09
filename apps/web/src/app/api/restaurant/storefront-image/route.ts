import { NextResponse } from 'next/server';
import { isRestaurantSuspended } from '@mesa/shared';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/permissions/require';
import type { PermissionKey } from '@/lib/permissions/registry';
import type { StorefrontImageKind } from '@/lib/restaurant-storefront-image';
import { setRestaurantStorefrontImage } from '@/lib/restaurant-storefront-server';

export const runtime = 'nodejs';

function parseKind(raw: unknown): StorefrontImageKind | null {
  return raw === 'cover' || raw === 'logo' ? raw : null;
}

export async function POST(req: Request) {
  const permission: PermissionKey = 'settings.profile.manage';
  const auth = await requirePermission(permission);
  if (auth instanceof NextResponse) return auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const kind = parseKind(form.get('kind'));
  if (!kind) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }

  const stripImage = form.get('strip_image') === '1';
  const fileEntry = form.get('file');
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  if (!stripImage && !file) {
    return NextResponse.json({ error: 'image_required' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: restaurantRow, error: suspendedErr } = await admin
    .from('restaurants')
    .select('suspended_at')
    .eq('id', auth.principal.restaurantId)
    .maybeSingle();
  if (suspendedErr || !restaurantRow) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  if (isRestaurantSuspended(restaurantRow.suspended_at)) {
    return NextResponse.json({ error: 'restaurant_suspended' }, { status: 403 });
  }

  const result = await setRestaurantStorefrontImage(
    admin,
    auth.principal.restaurantId,
    kind,
    file,
    stripImage,
  );
  if ('error' in result) {
    if (isDbMigrationRequiredError({ message: result.message })) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, kind: result.kind, url: result.url });
}
