import { NextResponse } from 'next/server';
import { loadMultiStoreOverview } from '@/lib/multi-store-overview';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';

export const dynamic = 'force-dynamic';

/**
 * Multi-store overview (plan §8.4): read-only, not under any store slug.
 * `?restaurant_ids=a,b` narrows to a subset of the account's authorized stores
 * (ids outside it are ignored, never 403). Auth is re-checked every request.
 */
export async function GET(req: Request) {
  const auth = await loadAuthUserWithAdmin();
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = new URL(req.url).searchParams.get('restaurant_ids');
  const restaurantIds = raw
    ? raw.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;

  try {
    const overview = await loadMultiStoreOverview(auth.user.id, { restaurantIds });
    return NextResponse.json(overview, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('[multi-store/overview]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
}
