import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { staffAuthFromRequestWithRoles } from '@/lib/staff-api-auth';
import type { ReceiptPrinterOption } from '@/lib/print-receipt-printer-options';
import { loadRestaurantReceiptPrinterSnapshot } from '@/lib/restaurant-receipt-printers-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug')?.trim();

  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const staffCtx = await staffAuthFromRequestWithRoles(req, slug, ['waiter', 'cashier']);
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
  const printers: ReceiptPrinterOption[] = snapshot?.receipt_printers ?? [];

  return NextResponse.json({
    printers,
    updated_at: snapshot?.updated_at ?? null,
  });
}
