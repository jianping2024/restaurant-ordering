import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerMenuCatalog } from '@/lib/customer-menu-catalog';
import { loadCustomerRestaurantForApi } from '@/lib/customer-session-context';
import { resolveMenuImageDisplayUrl } from '@/lib/menu-image';
import type { MenuItem } from '@/types';

export const runtime = 'nodejs';

const PRIVATE_SHORT_CACHE_HEADERS = {
  'Cache-Control': 'private, max-age=60',
};

function requestClientHostname(req: Request): string {
  const fromHeader = req.headers.get('host')?.split(':')[0]?.trim();
  if (fromHeader) return fromHeader;
  return new URL(req.url).hostname;
}

function rewriteCatalogImageUrls(catalog: { menuItems: MenuItem[] }, requestHost: string) {
  const hostname = requestHost.split(':')[0] ?? requestHost;
  return {
    ...catalog,
    menuItems: catalog.menuItems.map((item) => ({
      ...item,
      image_url: resolveMenuImageDisplayUrl(item.image_url, { clientHostname: hostname }),
    })),
  };
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
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
  return NextResponse.json(rewriteCatalogImageUrls(catalog, requestClientHostname(req)), {
    headers: PRIVATE_SHORT_CACHE_HEADERS,
  });
}
