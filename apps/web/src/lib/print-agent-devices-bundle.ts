import 'server-only';

import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PrintAgentDeviceHeartbeatRow } from '@/lib/print-agent-heartbeat';
import { stationLabelsFromRoutingSnapshot } from '@/lib/print-agent-routing';
import type { ReceiptPrinterRoutingSnapshot } from '@/lib/print-receipt-printer-options';
import { receiptPrinterSnapshotFromDeviceRows } from '@/lib/restaurant-receipt-printers-server';

export type PrintAgentDevicesBundle = {
  devices: PrintAgentDeviceHeartbeatRow[];
  receiptSnapshot: ReceiptPrinterRoutingSnapshot | null;
};

function mapDeviceHeartbeatRows(
  rows: Array<Record<string, unknown>>,
): PrintAgentDeviceHeartbeatRow[] {
  return rows.map((row) => {
    const { routing_snapshot, ...rest } = row as PrintAgentDeviceHeartbeatRow & {
      routing_snapshot?: unknown;
    };
    return {
      ...rest,
      mapped_station_labels: stationLabelsFromRoutingSnapshot(routing_snapshot),
    };
  });
}

/**
 * Restaurant-scoped device list. Callers must already authorize
 * (e.g. requireAnyPermission / print-assistant page). Uses service role because
 * RLS only allows restaurant owners to SELECT print_agent_devices.
 */
async function loadPrintAgentDevicesBundle(
  restaurantId: string,
): Promise<PrintAgentDevicesBundle> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { devices: [], receiptSnapshot: null };
  }

  const { data, error } = await admin
    .from('print_agent_devices')
    .select(
      'id, label, valid_until, revoked_at, last_seen, agent_version, mapped_station_count, routing_snapshot, paired_at, last_print_at, last_print_status, schedule_open, notification_mode',
    )
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .order('last_seen', { ascending: false, nullsFirst: false });

  if (error) {
    return { devices: [], receiptSnapshot: null };
  }

  const rows = (data || []) as Array<Record<string, unknown>>;
  return {
    devices: mapDeviceHeartbeatRows(rows),
    receiptSnapshot: receiptPrinterSnapshotFromDeviceRows(rows),
  };
}

/** Per-request dedup for print-assistant upper + lower panels. */
export const getPrintAgentDevicesBundle = cache(loadPrintAgentDevicesBundle);
