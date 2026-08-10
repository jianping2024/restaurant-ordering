import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  loadCustomerMenuCatalog,
  loadCustomerMenuCatalogVersion,
} from '@/lib/customer-menu-catalog';
import { loadCustomerRestaurantForApi } from '@/lib/customer-restaurant-gate';
import { CUSTOMER_READ_NO_STORE_HEADERS } from '@/lib/customer-read-http-headers';
import {
  clientHostnameFromRequest,
  clientPageOriginFromRequest,
  mapCustomerMenuCatalogImageUrls,
} from '@/lib/menu-image';

export const runtime = 'nodejs';

function parseKnownVersion(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json(
      { error: 'missing_slug' },
      { status: 400, headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: 'server_misconfigured' },
      { status: 503, headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
  }

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json(
      { error: loaded.error },
      { status: loaded.status, headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
  }

  const restaurantId = loaded.restaurant.id;
  const version = await loadCustomerMenuCatalogVersion(restaurantId);
  const knownVersion = parseKnownVersion(new URL(req.url).searchParams.get('knownVersion'));

  if (knownVersion != null && knownVersion === version) {
    return NextResponse.json(
      { version, unchanged: true },
      { headers: CUSTOMER_READ_NO_STORE_HEADERS },
    );
  }

  const catalog = await loadCustomerMenuCatalog(restaurantId);
  return NextResponse.json(
    {
      version,
      ...mapCustomerMenuCatalogImageUrls(catalog, {
        clientHostname: clientHostnameFromRequest(req),
        pageOrigin: clientPageOriginFromRequest(req),
      }),
    },
    { headers: CUSTOMER_READ_NO_STORE_HEADERS },
  );
}
