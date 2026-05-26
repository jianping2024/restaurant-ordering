import { NextResponse } from 'next/server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { fetchKitchenBoard } from '@/lib/staff-board';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(_req, slug, 'kitchen');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const board = await fetchKitchenBoard(admin, ctx.restaurant_id);

  return NextResponse.json({
    orders: board.orders,
    activeTableIds: board.activeTableIds,
  });
}
