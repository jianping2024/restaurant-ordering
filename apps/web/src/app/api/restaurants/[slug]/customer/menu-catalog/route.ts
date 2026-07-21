import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerMenuCatalog } from '@/lib/customer-menu-catalog';
import { loadCustomerRestaurantForApi } from '@/lib/customer-session-context';

export const runtime = 'nodejs';

const PRIVATE_SHORT_CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=60',
};

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const catalog = await loadCustomerMenuCatalog(loaded.restaurant.id);
  return NextResponse.json(catalog, { headers: PRIVATE_SHORT_CACHE_HEADERS });
}
