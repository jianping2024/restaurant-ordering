import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  normalizePrintAgentCloudConfig,
  parseDefaultReceiptStationId,
  type PrintAgentCloudConfig,
} from '@/lib/print-agent-config';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';
import {
  assertReceiptPrinterIdAllowed,
  loadRestaurantReceiptPrinterSnapshot,
} from '@/lib/restaurant-receipt-printers-server';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  const auth = await getOwnerRestaurantId({ requireWritable: true });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const raw =
    body && typeof body === 'object'
      ? (body as Record<string, unknown>).default_receipt_station_id
      : undefined;

  let default_receipt_station_id: string | undefined;
  if (raw === null || raw === '') {
    default_receipt_station_id = undefined;
  } else {
    const parsed = parseDefaultReceiptStationId(raw);
    if (!parsed) {
      return NextResponse.json({ error: 'invalid_station_id' }, { status: 400 });
    }
    default_receipt_station_id = parsed;
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  if (default_receipt_station_id) {
    const snapshot = await loadRestaurantReceiptPrinterSnapshot(admin, auth.restaurantId);
    if (!assertReceiptPrinterIdAllowed(default_receipt_station_id, snapshot)) {
      return NextResponse.json({ error: 'station_not_mapped' }, { status: 400 });
    }
  }

  const { data: row, error: readErr } = await admin
    .from('restaurants')
    .select('print_agent_config')
    .eq('id', auth.restaurantId)
    .single();
  if (readErr) {
    return NextResponse.json({ error: 'query_failed', message: readErr.message }, { status: 500 });
  }

  const existing = normalizePrintAgentCloudConfig(row?.print_agent_config);
  const merged: PrintAgentCloudConfig = { ...existing };
  if (default_receipt_station_id) {
    merged.default_receipt_station_id = default_receipt_station_id;
  } else {
    delete merged.default_receipt_station_id;
  }

  const { error } = await admin
    .from('restaurants')
    .update({ print_agent_config: merged })
    .eq('id', auth.restaurantId);

  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    default_receipt_station_id: merged.default_receipt_station_id ?? null,
  });
}
