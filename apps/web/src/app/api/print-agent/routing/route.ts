import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';
import {
  normalizeStationPrintersInput,
  saveDeviceRoutingSnapshot,
} from '@/lib/print-agent-routing';

export const runtime = 'nodejs';

/** Print agent reports station printer mapping after configure/setup save. */
export async function POST(req: Request) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const auth = await verifyActiveAgentBearer(req, admin);
  if (!auth) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { station_printers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const stationPrinters = normalizeStationPrintersInput(body.station_printers);

  const { data: stations } = await admin
    .from('print_stations')
    .select('id, name_pt, name_en, name_zh, sort_order')
    .eq('restaurant_id', auth.restaurant_id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  const result = await saveDeviceRoutingSnapshot(admin, {
    restaurantId: auth.restaurant_id,
    deviceId: auth.device_id,
    stationPrinters,
    stations: stations || [],
  });

  if (!result.ok) {
    if (result.code === 'invalid_station') {
      return NextResponse.json({ error: 'invalid_station', message: result.message }, { status: 400 });
    }
    if (result.code === 'station_mapping_conflict') {
      return NextResponse.json(
        {
          error: 'station_mapping_conflict',
          code: 'station_mapping_conflict',
          conflicts: result.conflicts,
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'update_failed', message: result.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, count: result.snapshot.receipt_printers.length });
}
