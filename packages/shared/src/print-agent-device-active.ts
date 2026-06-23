import type { SupabaseClient } from '@supabase/supabase-js';
import { isPrintAgentDeviceActive } from './print-agent-heartbeat';

/** DB check: device row exists, not revoked, and valid_until is in the future. */
export async function isPrintAgentDeviceActiveInDb(
  admin: SupabaseClient,
  deviceId: string,
  restaurantId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('print_agent_devices')
    .select('revoked_at, valid_until')
    .eq('id', deviceId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (error || !data) return false;
  return isPrintAgentDeviceActive(data.revoked_at, data.valid_until);
}
