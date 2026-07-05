import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const { id: restaurantId } = await context.params;

  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .maybeSingle();

  if (restaurantError) {
    return NextResponse.json(
      { error: 'fetch_failed', detail: restaurantError.message },
      { status: 500 },
    );
  }
  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: rows, error: listError } = await admin
    .from('restaurant_staff_accounts')
    .select('id, role, display_name, login_name, created_at, updated_at, disabled_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });

  if (listError) {
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (rows || []).map((row) => ({
      id: row.id,
      role: row.role,
      displayName: row.display_name,
      loginName: row.login_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      disabledAt: row.disabled_at,
    })),
  });
}
