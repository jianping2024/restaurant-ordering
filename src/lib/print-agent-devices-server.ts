import { createClient } from '@/lib/supabase/server';
import {
  devicesNeedingRenewal,
  type PrintAgentDeviceRow,
} from '@/lib/print-agent-credential-expiry';

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
