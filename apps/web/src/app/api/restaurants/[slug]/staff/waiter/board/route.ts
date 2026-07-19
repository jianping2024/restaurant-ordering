import { NextResponse } from 'next/server';
import { openTableAuthFromRequest } from '@/lib/staff-api-auth';
import { fetchWaiterBoard } from '@/lib/staff-board';
import { etagsMatch, waiterBoardEtag } from '@/lib/staff-board-etag';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const BOARD_CACHE_CONTROL = 'private, no-store';

function boardHeaders(etag: string): HeadersInit {
  return {
    ETag: etag,
    'Cache-Control': BOARD_CACHE_CONTROL,
  };
}

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

  const board = await fetchWaiterBoard(admin, ctx.restaurant_id);
  const etag = waiterBoardEtag(board);
  const ifNoneMatch = req.headers.get('if-none-match');

  if (etagsMatch(ifNoneMatch, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: boardHeaders(etag),
    });
  }

  return NextResponse.json(board, { headers: boardHeaders(etag) });
}
