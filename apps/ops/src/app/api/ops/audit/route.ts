import { NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';

const PAGE_SIZE = 30;

export async function GET(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdmin();
  if (error || !ctx || !admin) return error!;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const action = (url.searchParams.get('action') || '').trim();
  const restaurantId = (url.searchParams.get('restaurantId') || '').trim();

  let query = admin
    .from('platform_admin_audit_log')
    .select(
      'id, actor_user_id, action, target_type, target_id, restaurant_id, metadata, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (action) {
    query = query.eq('action', action);
  }
  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: rows, error: listError, count } = await query.range(from, from + PAGE_SIZE - 1);

  if (listError) {
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  const actorIds = Array.from(
    new Set((rows || []).map((r) => r.actor_user_id).filter(Boolean)),
  ) as string[];
  const actorEmails = new Map<string, string | null>();
  await Promise.all(
    actorIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      actorEmails.set(id, data.user?.email ?? null);
    }),
  );

  const restaurantIds = Array.from(
    new Set((rows || []).map((r) => r.restaurant_id).filter(Boolean)),
  ) as string[];
  const restaurantNames = new Map<string, string>();
  if (restaurantIds.length > 0) {
    const { data: restaurants } = await admin
      .from('restaurants')
      .select('id, name')
      .in('id', restaurantIds);
    for (const row of restaurants || []) {
      restaurantNames.set(row.id, row.name);
    }
  }

  const items = (rows || []).map((r) => ({
    id: r.id,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    restaurantId: r.restaurant_id,
    restaurantName: r.restaurant_id ? restaurantNames.get(r.restaurant_id) ?? null : null,
    metadata: r.metadata,
    createdAt: r.created_at,
    actorEmail: r.actor_user_id ? actorEmails.get(r.actor_user_id) ?? null : null,
  }));

  return NextResponse.json({
    items,
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
  });
}
