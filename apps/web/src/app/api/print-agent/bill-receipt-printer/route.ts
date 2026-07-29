import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseDefaultReceiptStationId } from '@/lib/print-agent-config';
import { mergeAndPersistPrintAgentConfig } from '@/lib/print-agent-config-patch-server';
import { requireSettingsRestaurantAuth } from '@/lib/settings-restaurant-auth';
import {
  assertReceiptPrinterIdAllowed,
  loadRestaurantReceiptPrinterSnapshot,
} from '@/lib/restaurant-receipt-printers-server';

export const runtime = 'nodejs';

export async function PATCH(req: Request) {
  const auth = await requireSettingsRestaurantAuth('settings.print_assistant.manage', {
    requireWritable: true,
  });
  if (auth instanceof NextResponse) return auth;

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

  let default_receipt_station_id: string | null;
  if (raw === null || raw === '') {
    default_receipt_station_id = null;
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

  const result = await mergeAndPersistPrintAgentConfig(admin, auth.restaurantId, {
    default_receipt_station_id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.error === 'query_failed' ? 500 : 500 },
    );
  }

  return NextResponse.json({
    default_receipt_station_id: result.config.default_receipt_station_id ?? null,
  });
}
