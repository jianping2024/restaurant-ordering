import { NextResponse } from 'next/server';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import { fetchWaiterBoard, fetchWaiterBoardLive } from '@/lib/staff-board';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseWaiterBoardFetchScope } from '@/lib/waiter-board-live';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await openTableAuthFromRequest(req, slug);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const scope = parseWaiterBoardFetchScope(new URL(req.url).searchParams.get('scope'));
  const body =
    scope === 'live'
      ? { scope: 'live' as const, live: await fetchWaiterBoardLive(admin, ctx.restaurant_id) }
      : { scope: 'full' as const, board: await fetchWaiterBoard(admin, ctx.restaurant_id) };

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
