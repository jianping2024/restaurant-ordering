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
      'id, name, slug, plan, deployment_mode, license_valid_until, suspended_at, suspension_reason, owner_email, owner_id, license_checked_at, created_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: installations, error: instError } = await admin
    .from('restaurant_installations')
    .select(
      'id, status, expires_at, consumed_at, claimed_at, revoked_at, last_checkin_at, created_at',
    )
    .eq('restaurant_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (instError) {
    return NextResponse.json({ error: 'installations_failed', detail: instError.message }, { status: 500 });
  }

  return NextResponse.json({
    restaurant: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      deploymentMode: row.deployment_mode,
      licenseValidUntil: row.license_valid_until,
      suspendedAt: row.suspended_at,
      suspensionReason: row.suspension_reason,
      ownerEmail: row.owner_email,
      ownerId: row.owner_id,
      licenseCheckedAt: row.license_checked_at,
      createdAt: row.created_at,
    },
    installations: installations || [],
  });
}
