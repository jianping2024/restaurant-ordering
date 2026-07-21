import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { devicesNeedingRenewal, type PrintAgentDeviceRow } from '@/lib/print-agent-credential-expiry';
import type { PrintAgentDeviceHeartbeatRow } from '@/lib/print-agent-heartbeat';
import { isPrintAgentDeviceOnline } from '@/lib/print-agent-heartbeat';
import { stationLabelsFromRoutingSnapshot } from '@/lib/print-agent-routing';

async function loadPrintAgentDevicesNeedingRenewal(
  restaurantId: string,
): Promise<PrintAgentDeviceRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('print_agent_devices')
    .select('id, label, valid_until, revoked_at')
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .order('valid_until', { ascending: true });

  if (error) {
    return [];
  }
  return devicesNeedingRenewal((data || []) as PrintAgentDeviceRow[]);
}

/** Per-request dedup for dashboard layout + print-assistant page. */
export const getPrintAgentDevicesNeedingRenewal = cache(loadPrintAgentDevicesNeedingRenewal);

export async function loadPrintAgentDevices(
  restaurantId: string,
): Promise<PrintAgentDeviceHeartbeatRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('print_agent_devices')
    .select(
      'id, label, valid_until, revoked_at, last_seen, agent_version, mapped_station_count, routing_snapshot, last_print_at, last_print_status, schedule_open, notification_mode',
    )
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .order('last_seen', { ascending: false, nullsFirst: false });

  if (error) {
    return [];
  }
  return (data || []).map((row) => {
    const { routing_snapshot, ...rest } = row as PrintAgentDeviceHeartbeatRow & {
      routing_snapshot?: unknown;
    };
    return {
      ...rest,
      mapped_station_labels: stationLabelsFromRoutingSnapshot(routing_snapshot),
    };
  });
}

/** Online-only subset for dashboard heartbeat display. */
export async function loadOnlinePrintAgentDevices(
  restaurantId: string,
): Promise<PrintAgentDeviceHeartbeatRow[]> {
  const devices = await loadPrintAgentDevices(restaurantId);
  return devices.filter((d) => isPrintAgentDeviceOnline(d.last_seen));
}
