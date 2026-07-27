import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
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

async function loadPrintAgentDevicesBundle(
  restaurantId: string,
): Promise<PrintAgentDevicesBundle> {
  const supabase = await createClient();
  const { data, error } = await supabase
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
