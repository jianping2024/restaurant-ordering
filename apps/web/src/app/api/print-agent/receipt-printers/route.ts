import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { staffAuthFromRequestWithRoles, CHECKOUT_AUTHORIZED_STAFF_ROLES } from '@/lib/staff-api-auth';
import {
  presentReceiptPrintersForCheckout,
  type ReceiptPrinterOption,
} from '@/lib/print-receipt-printer-options';
import { loadRestaurantReceiptPrinterSnapshot } from '@/lib/restaurant-receipt-printers-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug')?.trim();
  const langRaw = searchParams.get('lang')?.trim();
  const locale: 'pt' | 'en' | 'zh' =
    langRaw === 'zh' || langRaw === 'en' || langRaw === 'pt' ? langRaw : 'pt';

  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const staffCtx = await staffAuthFromRequestWithRoles(req, slug, CHECKOUT_AUTHORIZED_STAFF_ROLES);
  let restaurantId: string | null = null;

  if (staffCtx) {
    restaurantId = staffCtx.restaurant_id;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const { data: rest } = await admin
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!rest?.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    restaurantId = rest.id;
  }

  if (!restaurantId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const snapshot = await loadRestaurantReceiptPrinterSnapshot(admin, restaurantId);
  const { data: stations } = await admin
    .from('print_stations')
    .select('id, name_pt, name_en, name_zh, sort_order')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const printers: ReceiptPrinterOption[] = snapshot
    ? presentReceiptPrintersForCheckout(snapshot.receipt_printers, stations || [], locale)
    : [];

  return NextResponse.json({
    printers,
    updated_at: snapshot?.updated_at ?? null,
  });
}
