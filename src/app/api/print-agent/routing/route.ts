import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAgentBearer } from '@/lib/print-agent-auth';
import { buildReceiptPrinterSnapshot } from '@/lib/print-receipt-printer-options';

export const runtime = 'nodejs';

/** Print agent reports cashier + station printer mapping after configure/setup save. */
export async function POST(req: Request) {
  const auth = verifyAgentBearer(req);
  if (!auth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: {
    station_printers?: unknown;
    cashier_printer?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const stationPrinters: Record<string, string> = {};
  if (body.station_printers && typeof body.station_printers === 'object' && !Array.isArray(body.station_printers)) {
    for (const [k, v] of Object.entries(body.station_printers as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) stationPrinters[k] = v.trim();
    }
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: stations } = await admin
    .from('print_stations')
    .select('id, name_pt, name_en, name_zh, sort_order')
    .eq('restaurant_id', auth.restaurant_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const cashierConfigured =
    typeof body.cashier_printer === 'string' && body.cashier_printer.trim().length > 0;

  const snapshot = buildReceiptPrinterSnapshot({
    stationPrinters,
    stations: stations || [],
    cashierConfigured,
  });

  const { error } = await admin
    .from('print_agent_devices')
    .update({ routing_snapshot: snapshot })
    .eq('id', auth.device_id)
    .eq('restaurant_id', auth.restaurant_id);

  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: snapshot.receipt_printers.length });
}
