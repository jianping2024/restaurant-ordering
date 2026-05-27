import { createClient } from '@/lib/supabase/server';
import {
  devicesNeedingRenewal,
  type PrintAgentDeviceRow,
} from '@/lib/print-agent-credential-expiry';
import type { PrintAgentDeviceHeartbeatRow } from '@/lib/print-agent-heartbeat';

export async function loadPrintAgentDevicesNeedingRenewal(
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

export async function loadPrintAgentDevices(
  restaurantId: string,
): Promise<PrintAgentDeviceHeartbeatRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('print_agent_devices')
    .select(
      'id, label, valid_until, revoked_at, last_seen, agent_version, mapped_station_count, last_print_at, last_print_status, schedule_open',
    )
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .order('last_seen', { ascending: false, nullsFirst: false });

  if (error) {
    return [];
  }
  return (data || []) as PrintAgentDeviceHeartbeatRow[];
}
