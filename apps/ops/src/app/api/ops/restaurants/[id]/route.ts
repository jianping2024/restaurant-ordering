import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;
  const { data: row, error: fetchError } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, plan, created_at, owner_id, print_locale, feature_flags, address, phone',
    )
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: owner } = await admin.auth.admin.getUserById(row.owner_id);

  return NextResponse.json({
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    createdAt: row.created_at,
    ownerId: row.owner_id,
    ownerEmail: owner?.user?.email ?? null,
    printLocale: row.print_locale,
    featureFlags: row.feature_flags,
    address: row.address,
    phone: row.phone,
  });
}
