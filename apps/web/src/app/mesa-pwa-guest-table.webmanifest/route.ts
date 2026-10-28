import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { buildGuestTableManifest } from '@/lib/pwa/site-manifest';
import { guestTableMenuStartUrl } from '@/lib/pwa/guest-table-pwa-manifest';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Sole HTTP entry for per-table guest PWA manifests.
 * Query: slug + table_id — start_url is built here (never taken from the client).
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug')?.trim() ?? '';
  const tableId = parseTableIdParam(request.nextUrl.searchParams.get('table_id'));
  const startUrl = slug && tableId ? guestTableMenuStartUrl(slug, tableId) : null;
  if (!startUrl || !tableId) {
    return NextResponse.json({ error: 'invalid_manifest_params' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: table } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', restaurant.id)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const body = buildGuestTableManifest({
    restaurantName: restaurant.name as string,
    tableDisplayName: table.display_name as string,
    startUrl,
  });

  return new NextResponse(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
