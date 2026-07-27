import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { devicesNeedingRenewal, type PrintAgentDeviceRow } from '@/lib/print-agent-credential-expiry';
import type { PrintAgentDeviceHeartbeatRow } from '@/lib/print-agent-heartbeat';
import { isPrintAgentDeviceOnline } from '@/lib/print-agent-heartbeat';
import { getPrintAgentDevicesBundle } from '@/lib/print-agent-devices-bundle';

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
  const bundle = await getPrintAgentDevicesBundle(restaurantId);
  return bundle.devices;
}

/** Online-only subset for dashboard heartbeat display. */
export async function loadOnlinePrintAgentDevices(
  restaurantId: string,
): Promise<PrintAgentDeviceHeartbeatRow[]> {
  const devices = await loadPrintAgentDevices(restaurantId);
  return devices.filter((d) => isPrintAgentDeviceOnline(d.last_seen));
}
